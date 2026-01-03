import { useCallback, useState, useRef } from "react";
import { Alert } from "react-native";
import * as Crypto from "expo-crypto";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type {
  UIMessage,
  MessagePart,
  FilePart,
  ReasoningPart,
  ToolInvocationPart,
} from "@ourin/shared/types";
import {
  streamChat,
  generateTitle as apiGenerateTitle,
  type StreamEvent,
} from "@/lib/api";

interface UseOurinChatOptions {
  conversationId: string | null;
  initialMessages?: UIMessage[];
  model?: string;
  reasoningLevel?: string | number;
  onConversationCreate?: (id: string) => void;
  getActiveCoreNames?: () => string[];
  getActivePrompt?: () => string;
}

interface SendMessageInput {
  role: "user";
  parts: MessagePart[];
}

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export function useOurinChat({
  conversationId,
  initialMessages = [],
  model = "anthropic:claude-sonnet-4-5-20250929",
  reasoningLevel,
  onConversationCreate,
  getActiveCoreNames,
  getActivePrompt,
}: UseOurinChatOptions) {
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Keep refs for current values to avoid stale closures
  const messagesRef = useRef<UIMessage[]>(messages);
  messagesRef.current = messages;

  const conversationIdRef = useRef<string | null>(conversationId);
  conversationIdRef.current = conversationId;

  // Track partial response for saving on stop
  const partialResponseRef = useRef<string>("");

  // Track if we've generated a title for this conversation
  const hasGeneratedTitleRef = useRef<Set<string>>(new Set());

  // Convex mutations
  const appendMessage = useMutation(api.messages.append);
  const truncateFrom = useMutation(api.messages.truncateFrom);
  const createConversation = useMutation(api.conversations.create);
  const updateTitle = useMutation(api.conversations.updateTitle);
  const generateChatToken = useMutation(api.chatAuth.generateChatToken);
  const createStreamingMessage = useMutation(
    api.messages.createStreamingMessage
  );
  const updateStreamingMessage = useMutation(
    api.messages.updateStreamingMessage
  );

  /**
   * Generate and save a title for a conversation
   */
  const generateTitle = useCallback(
    async (convId: string, userMessageText: string) => {
      if (hasGeneratedTitleRef.current.has(convId)) return;
      hasGeneratedTitleRef.current.add(convId);

      try {
        const tokenResult = await generateChatToken();
        if (!tokenResult) return;

        const title = await apiGenerateTitle(
          tokenResult.token,
          convId,
          userMessageText
        );

        if (title) {
          await updateTitle({
            id: convId as Id<"conversations">,
            title,
          });
        }
      } catch {
        // Silently fail
      }
    },
    [updateTitle, generateChatToken]
  );

  /**
   * Stream a response from the AI
   */
  const streamResponse = useCallback(
    async (
      messagesToSend: UIMessage[],
      convId: string,
      controller: AbortController,
      modelOverride?: string,
      reasoningLevelOverride?: string | number,
      webSearchEnabled?: boolean,
      streamingOptions?: {
        coreNames?: string[];
        persistToDb?: boolean;
      }
    ): Promise<{
      fullText: string;
      aborted: boolean;
      orderedParts: MessagePart[];
      totalThinkingDuration: number;
      assistantMessageId: string;
    }> => {
      const streamModel = modelOverride ?? model;
      const streamReasoningLevel = reasoningLevelOverride ?? reasoningLevel;
      partialResponseRef.current = "";

      const assistantMessageId = Crypto.randomUUID();

      // Create assistant message placeholder
      const assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: [{ type: "text", text: "" }],
        model: streamModel,
        createdAt: new Date(),
        metadata: {
          ...(streamingOptions?.coreNames && {
            coreNames: streamingOptions.coreNames,
          }),
          ...(streamReasoningLevel !== undefined && {
            reasoningLevel: streamReasoningLevel,
          }),
        },
      };

      const messagesWithAssistant = [...messagesToSend, assistantMessage];
      if (conversationIdRef.current === convId) {
        setMessages(messagesWithAssistant);
        setStatus("streaming");
      }

      // Persist empty assistant message to DB immediately
      const shouldPersist = streamingOptions?.persistToDb !== false;
      if (shouldPersist) {
        createStreamingMessage({
          conversationId: convId as Id<"conversations">,
          messageId: assistantMessageId,
          model: streamModel,
          metadata: assistantMessage.metadata,
        }).catch((err) => {
          console.warn("Failed to create streaming message:", err);
        });
      }

      // Track parts
      let totalThinkingDuration = 0;
      const orderedParts: MessagePart[] = [];
      const toolInvocations = new Map<string, ToolInvocationPart>();
      let currentReasoningText = "";
      let currentReasoningId: string | null = null;
      let currentReasoningStartTime: number | null = null;
      let currentTextPartIndex: number | null = null;

      const finalizeCurrentReasoning = () => {
        if (currentReasoningText && currentReasoningId) {
          const blockDuration = currentReasoningStartTime
            ? Math.round((Date.now() - currentReasoningStartTime) / 1000)
            : 0;
          const existingIndex = orderedParts.findIndex(
            (p) =>
              p.type === "reasoning" &&
              (p as ReasoningPart).id === currentReasoningId
          );
          if (existingIndex === -1) {
            orderedParts.push({
              type: "reasoning",
              text: currentReasoningText,
              id: currentReasoningId,
              duration: blockDuration > 0 ? blockDuration : undefined,
            });
            totalThinkingDuration += blockDuration;
          }
        }
        currentReasoningText = "";
        currentReasoningId = null;
        currentReasoningStartTime = null;
      };

      const finalizeCurrentText = () => {
        currentTextPartIndex = null;
      };

      // Set up persistence interval
      let streamingInterval: ReturnType<typeof setInterval> | null = null;
      let lastPersistedParts = "";

      const persistCurrentParts = () => {
        if (!shouldPersist) return;

        const partsSnapshot = [...orderedParts];
        if (currentReasoningText && currentReasoningId) {
          const existingIdx = partsSnapshot.findIndex(
            (p) =>
              p.type === "reasoning" &&
              (p as ReasoningPart).id === currentReasoningId
          );
          if (existingIdx === -1) {
            partsSnapshot.push({
              type: "reasoning",
              text: currentReasoningText,
            });
          }
        }

        const partsKey = JSON.stringify(partsSnapshot);
        if (partsKey === lastPersistedParts) return;
        lastPersistedParts = partsKey;

        updateStreamingMessage({
          messageId: assistantMessageId,
          conversationId: convId as Id<"conversations">,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parts: partsSnapshot as any,
        }).catch((err) => {
          console.warn("Failed to update streaming message:", err);
        });
      };

      try {
        const tokenResult = await generateChatToken();
        if (!tokenResult) {
          throw new Error("Failed to get chat token - not authenticated");
        }

        if (shouldPersist) {
          streamingInterval = setInterval(persistCurrentParts, 250);
        }

        // Handle stream events
        const handleStreamEvent = (event: StreamEvent) => {
          switch (event.type) {
            case "text-delta": {
              finalizeCurrentReasoning();
              const delta = String(event.data);
              partialResponseRef.current += delta;

              if (currentTextPartIndex === null) {
                currentTextPartIndex = orderedParts.length;
                orderedParts.push({ type: "text", text: delta });
              } else {
                const textPart = orderedParts[currentTextPartIndex] as {
                  type: "text";
                  text: string;
                };
                textPart.text += delta;
              }
              break;
            }

            case "reasoning-start": {
              finalizeCurrentText();
              finalizeCurrentReasoning();
              const parsed = event.data as { id?: string } | undefined;
              currentReasoningId = `reasoning-${parsed?.id ?? "0"}`;
              currentReasoningText = "";
              currentReasoningStartTime = Date.now();
              break;
            }

            case "reasoning-delta": {
              const delta = String(event.data);
              if (!currentReasoningId) {
                currentReasoningId = "reasoning-0";
                currentReasoningStartTime = Date.now();
              }
              currentReasoningText += delta;
              break;
            }

            case "reasoning-end": {
              finalizeCurrentReasoning();
              break;
            }

            case "tool-input-start": {
              finalizeCurrentText();
              finalizeCurrentReasoning();
              const parsed = event.data as {
                toolCallId: string;
                toolName?: string;
              };
              const toolPart: ToolInvocationPart = {
                type: "tool-invocation",
                toolInvocationId: parsed.toolCallId,
                toolName: parsed.toolName || "unknown",
                args: {},
                state: "call",
              };
              toolInvocations.set(parsed.toolCallId, toolPart);
              orderedParts.push(toolPart);
              break;
            }

            case "tool-result": {
              const parsed = event.data as {
                toolCallId: string;
                result?: unknown;
              };
              const tool = toolInvocations.get(parsed.toolCallId);
              if (tool) {
                tool.state = "result";
                tool.result = parsed.result;
              }
              break;
            }

            case "sources": {
              const sources = event.data as Array<{
                title: string;
                url: string;
                snippet?: string;
              }>;
              orderedParts.push({ type: "sources", sources });
              break;
            }

            case "error": {
              const errorData = event.data as {
                message?: string;
                code?: string;
              };
              throw new Error(
                errorData?.message || errorData?.code || "Stream error"
              );
            }
          }

          // Update UI with current parts
          const parts: MessagePart[] = [...orderedParts];
          if (currentReasoningText && currentReasoningId) {
            const existingIndex = parts.findIndex(
              (p) =>
                p.type === "reasoning" &&
                (p as ReasoningPart).id === currentReasoningId
            );
            if (existingIndex === -1) {
              parts.push({ type: "reasoning", text: currentReasoningText });
            } else {
              (parts[existingIndex] as { text: string }).text =
                currentReasoningText;
            }
          }

          if (conversationIdRef.current === convId) {
            setMessages((prev) =>
              prev.map((msg, i) => {
                if (i === prev.length - 1 && msg.role === "assistant") {
                  return { ...msg, parts };
                }
                return msg;
              })
            );
          }
        };

        // Stream the response
        await streamChat(
          tokenResult.token,
          {
            messages: messagesToSend,
            conversationId: convId,
            model: streamModel,
            systemPrompt: getActivePrompt?.(),
            reasoningLevel:
              streamReasoningLevel !== undefined
                ? String(streamReasoningLevel)
                : undefined,
            webSearchEnabled: webSearchEnabled ?? false,
          },
          handleStreamEvent,
          controller.signal
        );

        // Finalize
        finalizeCurrentReasoning();

        if (streamingInterval) {
          clearInterval(streamingInterval);
          streamingInterval = null;
        }

        // Final persistence
        if (shouldPersist) {
          const finalMetadata = {
            ...(streamingOptions?.coreNames && {
              coreNames: streamingOptions.coreNames,
            }),
            ...(streamReasoningLevel !== undefined && {
              reasoningLevel: streamReasoningLevel,
            }),
            ...(totalThinkingDuration > 0 && {
              thinkingDuration: totalThinkingDuration,
            }),
          };

          updateStreamingMessage({
            messageId: assistantMessageId,
            conversationId: convId as Id<"conversations">,
            parts: [...orderedParts] as any,
            metadata:
              Object.keys(finalMetadata).length > 0 ? finalMetadata : undefined,
          }).catch((err) => {
            console.warn("Failed to finalize streaming message:", err);
          });
        }

        return {
          fullText: partialResponseRef.current,
          aborted: false,
          orderedParts: [...orderedParts],
          totalThinkingDuration,
          assistantMessageId,
        };
      } catch (err) {
        if (streamingInterval) {
          clearInterval(streamingInterval);
          streamingInterval = null;
        }

        if ((err as Error).name === "AbortError") {
          finalizeCurrentReasoning();
          finalizeCurrentText();

          if (shouldPersist) {
            updateStreamingMessage({
              messageId: assistantMessageId,
              conversationId: convId as Id<"conversations">,
              parts: [...orderedParts] as any,
            }).catch((persistErr) => {
              console.warn("Failed to persist aborted message:", persistErr);
            });
          }

          return {
            fullText: partialResponseRef.current,
            aborted: true,
            orderedParts: [...orderedParts],
            totalThinkingDuration,
            assistantMessageId,
          };
        }

        // For non-abort errors, persist partial content
        finalizeCurrentReasoning();
        finalizeCurrentText();

        if (shouldPersist && orderedParts.length > 0) {
          updateStreamingMessage({
            messageId: assistantMessageId,
            conversationId: convId as Id<"conversations">,
            parts: [...orderedParts] as any,
          }).catch((persistErr) => {
            console.warn("Failed to persist errored message:", persistErr);
          });
        }

        throw err;
      }
    },
    [
      model,
      reasoningLevel,
      generateChatToken,
      getActivePrompt,
      createStreamingMessage,
      updateStreamingMessage,
    ]
  );

  /**
   * Send a new user message and get AI response
   */
  const sendMessage = useCallback(
    async (
      input: SendMessageInput | string,
      options?: { webSearchEnabled?: boolean }
    ) => {
      const coreNames = getActiveCoreNames?.() ?? [];

      // Parse input into user message
      const userMessage: UIMessage =
        typeof input === "string"
          ? {
              id: Crypto.randomUUID(),
              role: "user",
              parts: [{ type: "text", text: input }],
              model,
              createdAt: new Date(),
              metadata: {
                coreNames,
                ...(reasoningLevel !== undefined && { reasoningLevel }),
                ...(options?.webSearchEnabled && { webSearchEnabled: true }),
              },
            }
          : {
              id: Crypto.randomUUID(),
              role: "user",
              parts: input.parts,
              model,
              createdAt: new Date(),
              metadata: {
                coreNames,
                ...(reasoningLevel !== undefined && { reasoningLevel }),
                ...(options?.webSearchEnabled && { webSearchEnabled: true }),
              },
            };

      // Create conversation if needed
      let convId = conversationIdRef.current;
      if (!convId) {
        convId = await createConversation({ model });
        onConversationCreate?.(convId);
      }

      const currentMessages = messagesRef.current;
      const updatedMessages = [...currentMessages, userMessage];

      if (conversationIdRef.current === convId) {
        setMessages(updatedMessages);
        setStatus("submitted");
      }
      setError(null);

      // Save user message immediately
      await appendMessage({
        conversationId: convId as Id<"conversations">,
        message: {
          id: userMessage.id,
          role: userMessage.role,
          parts: userMessage.parts as any,
          model: userMessage.model,
          createdAt:
            userMessage.createdAt instanceof Date
              ? userMessage.createdAt.getTime()
              : userMessage.createdAt,
          metadata: userMessage.metadata,
        },
      });

      // Generate title for new conversations
      if (currentMessages.length === 0) {
        const userText = userMessage.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join(" ");
        if (userText) {
          generateTitle(convId, userText);
        }
      }

      // Create abort controller
      const controller = new AbortController();
      setAbortController(controller);

      try {
        const { orderedParts, totalThinkingDuration, assistantMessageId } =
          await streamResponse(
            updatedMessages,
            convId,
            controller,
            undefined,
            undefined,
            options?.webSearchEnabled,
            { coreNames, persistToDb: true }
          );

        // Update assistant message with final metadata
        if (conversationIdRef.current === convId) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId && msg.role === "assistant") {
                return {
                  ...msg,
                  parts: [...orderedParts] as any,
                  metadata: {
                    ...msg.metadata,
                    coreNames,
                    ...(reasoningLevel !== undefined && { reasoningLevel }),
                    ...(totalThinkingDuration > 0 && {
                      thinkingDuration: totalThinkingDuration,
                    }),
                  },
                };
              }
              return msg;
            })
          );
        }
        setStatus("ready");
      } catch (err) {
        if (conversationIdRef.current === convId) {
          setMessages(updatedMessages);
        }
        setError(err as Error);
        setStatus("error");

        // Show error alert
        Alert.alert(
          "Error",
          (err as Error).message || "Failed to send message"
        );
      } finally {
        setAbortController(null);
      }
    },
    [
      model,
      createConversation,
      onConversationCreate,
      streamResponse,
      appendMessage,
      generateTitle,
      getActiveCoreNames,
      reasoningLevel,
    ]
  );

  /**
   * Stop the current generation
   */
  const stop = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
  }, [abortController]);

  /**
   * Regenerate the assistant response
   */
  const regenerate = useCallback(
    async (options?: {
      messageId?: string;
      model?: string;
      reasoningLevel?: string | number;
      webSearchEnabled?: boolean;
    }) => {
      const currentMessages = messagesRef.current;
      const convId = conversationIdRef.current;

      if (!convId) return;

      const regenModel = options?.model ?? model;
      const regenReasoningLevel = options?.reasoningLevel ?? reasoningLevel;
      const regenWebSearchEnabled = options?.webSearchEnabled ?? false;
      const coreNames = getActiveCoreNames?.() ?? [];

      // Find message to regenerate from
      let targetIndex = currentMessages.length - 1;

      if (options?.messageId) {
        targetIndex = currentMessages.findIndex(
          (m) => m.id === options.messageId
        );
        if (targetIndex === -1) return;
      }

      // Find assistant message at or before targetIndex
      while (
        targetIndex >= 0 &&
        currentMessages[targetIndex].role !== "assistant"
      ) {
        targetIndex--;
      }

      if (targetIndex < 0) return;

      // Find user message that prompted this response
      let userMessageIndex = targetIndex - 1;
      while (
        userMessageIndex >= 0 &&
        currentMessages[userMessageIndex].role !== "user"
      ) {
        userMessageIndex--;
      }

      if (userMessageIndex < 0) return;

      const userMessageToRegen = currentMessages[userMessageIndex];
      const messagesBeforeUser = currentMessages.slice(0, userMessageIndex);

      // Create new user message copy
      const newUserMessage: UIMessage = {
        id: Crypto.randomUUID(),
        role: "user",
        parts: userMessageToRegen.parts,
        model: regenModel,
        createdAt: new Date(),
        metadata: {
          coreNames,
          ...(regenReasoningLevel !== undefined && {
            reasoningLevel: regenReasoningLevel,
          }),
          ...(regenWebSearchEnabled && { webSearchEnabled: true }),
        },
      };

      const messagesWithNewUser = [...messagesBeforeUser, newUserMessage];

      if (conversationIdRef.current === convId) {
        setMessages(messagesWithNewUser);
        setStatus("submitted");
      }
      setError(null);

      // Soft-delete old messages
      await truncateFrom({
        conversationId: convId as Id<"conversations">,
        fromMessageId: userMessageToRegen.id,
      });

      // Save new user message
      await appendMessage({
        conversationId: convId as Id<"conversations">,
        message: {
          id: newUserMessage.id,
          role: newUserMessage.role,
          parts: newUserMessage.parts as any,
          model: newUserMessage.model,
          createdAt:
            newUserMessage.createdAt instanceof Date
              ? newUserMessage.createdAt.getTime()
              : newUserMessage.createdAt,
          metadata: newUserMessage.metadata,
        },
      });

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const { orderedParts, totalThinkingDuration, assistantMessageId } =
          await streamResponse(
            messagesWithNewUser,
            convId,
            controller,
            regenModel,
            regenReasoningLevel,
            regenWebSearchEnabled,
            { coreNames, persistToDb: true }
          );

        if (conversationIdRef.current === convId) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId && msg.role === "assistant") {
                return {
                  ...msg,
                  parts: [...orderedParts] as any,
                  metadata: {
                    ...msg.metadata,
                    coreNames,
                    ...(regenReasoningLevel !== undefined && {
                      reasoningLevel: regenReasoningLevel,
                    }),
                    ...(totalThinkingDuration > 0 && {
                      thinkingDuration: totalThinkingDuration,
                    }),
                  },
                };
              }
              return msg;
            })
          );
        }
        setStatus("ready");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          if (conversationIdRef.current === convId) {
            setError(err as Error);
          }
          setStatus("error");

          Alert.alert(
            "Error",
            (err as Error).message || "Failed to regenerate"
          );
        }
      } finally {
        setAbortController(null);
      }
    },
    [
      streamResponse,
      truncateFrom,
      appendMessage,
      model,
      getActiveCoreNames,
      reasoningLevel,
    ]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    status,
    error,
    sendMessage,
    stop,
    regenerate,
    setMessages,
    clearError,
  };
}
