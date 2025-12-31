"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  UIMessage,
  MessagePart,
  FilePart,
  ToolInvocationPart,
} from "@/types/chat";
import { toast } from "sonner";
import { useAnonymousAuth } from "./useAnonymousAuth";

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
  // Get anonymous auth helper - this manages auto sign-in
  const { ensureAuthenticated, isAuthenticated } = useAnonymousAuth();

  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Track which conversation is currently streaming (for multi-conversation support)
  const [streamingConversationId, setStreamingConversationId] = useState<
    string | null
  >(null);

  // Keep refs for current values to avoid stale closures
  const messagesRef = useRef<UIMessage[]>(messages);
  messagesRef.current = messages;

  const conversationIdRef = useRef<string | null>(conversationId);
  conversationIdRef.current = conversationId;

  // Track previous conversationId to detect navigation
  const prevConversationIdRef = useRef<string | null>(conversationId);

  // Snapshot of messages when streaming starts - used to restore state when navigating back
  // to a conversation that's still streaming
  const streamingMessagesSnapshotRef = useRef<{
    conversationId: string;
    messages: UIMessage[];
  } | null>(null);

  // Track partial response for saving on stop
  const partialResponseRef = useRef<string>("");

  // Track if we've generated a title for this conversation
  const hasGeneratedTitleRef = useRef<Set<string>>(new Set());

  // Effect to restore messages when navigating back to a streaming conversation
  // This handles the case where user previews other conversations while one is streaming,
  // then returns to the streaming conversation
  useEffect(() => {
    const prevConvId = prevConversationIdRef.current;
    prevConversationIdRef.current = conversationId;

    // Check if we're navigating back TO a streaming conversation
    if (
      conversationId &&
      conversationId !== prevConvId &&
      conversationId === streamingConversationId &&
      streamingMessagesSnapshotRef.current?.conversationId === conversationId
    ) {
      // Restore the snapshot messages for the streaming conversation
      setMessages(streamingMessagesSnapshotRef.current.messages);
    }
  }, [conversationId, streamingConversationId]);

  // Convex mutations
  const appendMessage = useMutation(api.messages.append);
  const truncateFrom = useMutation(api.messages.truncateFrom);
  const createConversation = useMutation(api.conversations.create);
  const updateTitle = useMutation(api.conversations.updateTitle);
  const forkConversationMutation = useMutation(api.conversations.fork);
  const generateChatToken = useMutation(api.chatAuth.generateChatToken);
  const createStreamingMessage = useMutation(
    api.messages.createStreamingMessage
  );
  const updateStreamingMessage = useMutation(
    api.messages.updateStreamingMessage
  );

  /**
   * Generate and save a title for a conversation based on the first user message
   */
  const generateTitle = useCallback(
    async (convId: string, userMessageText: string) => {
      // Skip if we've already generated a title for this conversation
      if (hasGeneratedTitleRef.current.has(convId)) return;
      hasGeneratedTitleRef.current.add(convId);

      try {
        // Get auth token for API call
        const tokenResult = await generateChatToken();
        if (!tokenResult) return;

        const response = await fetch("/api/chat/title", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenResult.token}`,
          },
          body: JSON.stringify({
            userMessage: userMessageText,
          }),
        });

        if (!response.ok) return;

        const { title } = await response.json();
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
   * Internal helper to stream a response from the AI
   * Does NOT add a user message - just streams assistant response for given messages
   * Persists streaming progress to DB every 250ms for crash recovery
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
      // Use override values if provided
      const streamModel = modelOverride ?? model;
      const streamReasoningLevel = reasoningLevelOverride ?? reasoningLevel;
      partialResponseRef.current = "";

      // Generate assistant message ID once at the start - used for both UI and DB
      const assistantMessageId = crypto.randomUUID();

      // Create assistant message placeholder BEFORE changing status
      // This ensures "Thinking..." transitions smoothly without a blank gap
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
      // Only update UI if still viewing this conversation
      if (conversationIdRef.current === convId) {
        setMessages(messagesWithAssistant);
        setStatus("streaming");
        setStreamingConversationId(convId);
      }

      // Save snapshot for restoration when user navigates back during streaming
      streamingMessagesSnapshotRef.current = {
        conversationId: convId,
        messages: messagesWithAssistant,
      };

      // Persist empty assistant message to DB immediately for crash recovery
      // With anonymous auth, all users have real IDs and can persist
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

      // Track parts OUTSIDE try block so they're accessible in catch for abort handling
      let totalThinkingDuration = 0;
      const orderedParts: MessagePart[] = [];
      const toolInvocations = new Map<string, ToolInvocationPart>();
      let currentReasoningText = "";
      let currentReasoningId: string | null = null;
      let currentReasoningStartTime: number | null = null;
      let currentTextPartIndex: number | null = null;

      // Helper to finalize current reasoning block
      const finalizeCurrentReasoning = () => {
        if (currentReasoningText && currentReasoningId) {
          const blockDuration = currentReasoningStartTime
            ? Math.round((Date.now() - currentReasoningStartTime) / 1000)
            : 0;
          const existingIndex = orderedParts.findIndex(
            (p) =>
              p.type === "reasoning" &&
              (p as { id?: string }).id === currentReasoningId
          );
          if (existingIndex === -1) {
            orderedParts.push({
              type: "reasoning" as const,
              text: currentReasoningText,
              id: currentReasoningId,
              duration: blockDuration > 0 ? blockDuration : undefined,
            } as MessagePart);
            totalThinkingDuration += blockDuration;
          }
        }
        currentReasoningText = "";
        currentReasoningId = null;
        currentReasoningStartTime = null;
      };

      // Helper to finalize current text part
      const finalizeCurrentText = () => {
        currentTextPartIndex = null;
      };

      // Set up 250ms interval for persisting streaming progress
      let streamingInterval: ReturnType<typeof setInterval> | null = null;
      let lastPersistedParts: string = ""; // Track last persisted state to avoid redundant updates

      const persistCurrentParts = () => {
        if (!shouldPersist) return;

        // Create a snapshot of current parts for persistence
        const partsSnapshot = [...orderedParts];

        // Add in-progress reasoning if any
        if (currentReasoningText && currentReasoningId) {
          const existingIdx = partsSnapshot.findIndex(
            (p) =>
              p.type === "reasoning" &&
              (p as { id?: string }).id === currentReasoningId
          );
          if (existingIdx === -1) {
            partsSnapshot.push({
              type: "reasoning" as const,
              text: currentReasoningText,
            });
          }
        }

        // Only persist if parts have changed
        const partsKey = JSON.stringify(partsSnapshot);
        if (partsKey === lastPersistedParts) return;
        lastPersistedParts = partsKey;

        updateStreamingMessage({
          messageId: assistantMessageId,
          conversationId: convId as Id<"conversations">,
          parts: partsSnapshot,
        }).catch((err) => {
          console.warn("Failed to update streaming message:", err);
        });
      };

      try {
        // Get auth token for API call
        const tokenResult = await generateChatToken();
        if (!tokenResult) {
          throw new Error("Failed to get chat token - not authenticated");
        }

        // Start 250ms persistence interval
        if (shouldPersist) {
          streamingInterval = setInterval(persistCurrentParts, 250);
        }

        // Call AI API - get fresh system prompt each time to reflect core changes
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenResult.token}`,
          },
          body: JSON.stringify({
            messages: messagesToSend,
            conversationId: convId,
            model: streamModel,
            reasoningLevel: streamReasoningLevel,
            systemPrompt: getActivePrompt?.() || undefined,
            webSearchEnabled: webSearchEnabled ?? false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // Try to parse error response for specific error codes
          try {
            const errorData = await response.json();
            const errorCode = errorData.code;
            const errorDetails = errorData.details || errorData.error;

            // Toasts for specific error codes
            switch (errorCode) {
              case "MODEL_RESTRICTED":
                toast.error("Model not available", {
                  description: errorDetails,
                });
                break;
              case "FREE_LIMIT_REACHED":
                toast.error("Message limit reached", {
                  description: errorDetails,
                });
                break;
              case "NO_API_KEY":
                toast.error("API key required", {
                  description: errorDetails,
                });
                break;
              case "CREDITS_DEPLETED":
                toast.error("Credits depleted", {
                  description: errorDetails,
                });
                break;
              case "KEY_DECRYPT_ERROR":
                toast.error("API key error", {
                  description: errorDetails,
                });
                break;
              default:
                toast.error("Error", {
                  description: errorDetails || `API error: ${response.status}`,
                });
            }
            throw new Error(errorDetails || `API error: ${response.status}`);
          } catch (parseErr) {
            // If we couldn't parse the error, throw generic error
            if (
              parseErr instanceof Error &&
              parseErr.message !== `API error: ${response.status}`
            ) {
              throw parseErr;
            }
            throw new Error(`API error: ${response.status}`);
          }
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read UI message stream format
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from buffer (SSE format: "type:json\n")
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;

            const colonIndex = line.indexOf(":");
            if (colonIndex === -1) continue;

            const type = line.slice(0, colonIndex);
            const data = line.slice(colonIndex + 1);

            try {
              // UI Message Stream format (from toUIMessageStreamResponse)
              if (type === "data") {
                const parsed = JSON.parse(data);

                if (parsed.type === "text-delta" && parsed.delta) {
                  // Text started - finalize any pending reasoning
                  finalizeCurrentReasoning();
                  fullText += parsed.delta;
                  partialResponseRef.current = fullText;

                  // Track text in orderedParts for chronological rendering
                  if (currentTextPartIndex === null) {
                    // Start a new text part
                    currentTextPartIndex = orderedParts.length;
                    orderedParts.push({
                      type: "text" as const,
                      text: parsed.delta,
                    } as MessagePart);
                  } else {
                    // Append to existing text part
                    const textPart = orderedParts[currentTextPartIndex] as {
                      type: "text";
                      text: string;
                    };
                    textPart.text += parsed.delta;
                  }
                } else if (parsed.type === "reasoning-start") {
                  // New reasoning block started - finalize any previous text and reasoning
                  finalizeCurrentText();
                  finalizeCurrentReasoning();
                  // Use the stream's ID directly (e.g., '0', '3', '6')
                  currentReasoningId = `reasoning-${parsed.id}`;
                  currentReasoningText = "";
                  currentReasoningStartTime = Date.now();
                } else if (parsed.type === "reasoning-delta" && parsed.delta) {
                  // Use the stream's ID - if it changed, this is a new block
                  const streamId = `reasoning-${parsed.id}`;
                  if (currentReasoningId && currentReasoningId !== streamId) {
                    // Different ID means new reasoning block
                    finalizeCurrentReasoning();
                    currentReasoningId = streamId;
                    currentReasoningText = "";
                    currentReasoningStartTime = Date.now();
                  }

                  // Start a new reasoning block if we don't have one
                  if (!currentReasoningId) {
                    currentReasoningId = streamId;
                    currentReasoningStartTime = Date.now();
                  }
                  currentReasoningText += parsed.delta;

                  // Update the reasoning part in orderedParts if it exists, or it will be added when finalized
                  const existingIndex = orderedParts.findIndex(
                    (p) =>
                      p.type === "reasoning" &&
                      (p as { id?: string }).id === currentReasoningId
                  );
                  if (existingIndex >= 0) {
                    (orderedParts[existingIndex] as { text: string }).text =
                      currentReasoningText;
                  }
                } else if (
                  parsed.type === "reasoning-end" ||
                  parsed.type === "reasoning-finish"
                ) {
                  // Reasoning block ended - finalize it
                  finalizeCurrentReasoning();
                } else if (
                  parsed.type === "tool-input-start" &&
                  parsed.toolCallId
                ) {
                  // Tool call started - finalize any pending text and reasoning first
                  finalizeCurrentText();
                  finalizeCurrentReasoning();

                  const toolPart: ToolInvocationPart = {
                    type: "tool-invocation",
                    toolInvocationId: parsed.toolCallId,
                    toolName: parsed.toolName || "unknown",
                    args: {},
                    state: "call",
                  };
                  toolInvocations.set(parsed.toolCallId, toolPart);
                  orderedParts.push(toolPart);
                } else if (
                  parsed.type === "tool-input-available" &&
                  parsed.toolCallId
                ) {
                  // Update existing tool invocation with input, or create new one
                  const existing = toolInvocations.get(parsed.toolCallId);
                  if (existing) {
                    // Update args with the input (this contains the query for web search)
                    existing.args = parsed.input || {};
                  } else {
                    // Tool wasn't started yet, finalize text and reasoning and add it
                    finalizeCurrentText();
                    finalizeCurrentReasoning();
                    const toolPart: ToolInvocationPart = {
                      type: "tool-invocation",
                      toolInvocationId: parsed.toolCallId,
                      toolName: parsed.toolName || "unknown",
                      args: parsed.input || {},
                      state: "call",
                    };
                    toolInvocations.set(parsed.toolCallId, toolPart);
                    orderedParts.push(toolPart);
                  }
                } else if (
                  parsed.type === "tool-output-available" &&
                  parsed.toolCallId
                ) {
                  const tool = toolInvocations.get(parsed.toolCallId);
                  if (tool) {
                    tool.state = "result";
                    tool.result = parsed.output;
                  }
                } else if (parsed.type === "tool-call" && parsed.toolCallId) {
                  // Alternative tool call format - finalize text and reasoning first
                  finalizeCurrentText();
                  finalizeCurrentReasoning();

                  const existing = toolInvocations.get(parsed.toolCallId);
                  if (existing) {
                    existing.args = parsed.args || {};
                  } else {
                    const toolPart: ToolInvocationPart = {
                      type: "tool-invocation",
                      toolInvocationId: parsed.toolCallId,
                      toolName: parsed.toolName || "unknown",
                      args: parsed.args || {},
                      state: "call",
                    };
                    toolInvocations.set(parsed.toolCallId, toolPart);
                    orderedParts.push(toolPart);
                  }
                } else if (parsed.type === "tool-result" && parsed.toolCallId) {
                  // Alternative tool result format
                  const tool = toolInvocations.get(parsed.toolCallId);
                  if (tool) {
                    tool.state = "result";
                    tool.result = parsed.result;
                  }
                }
              }
            } catch {
              // Skip malformed lines
            }
          }

          // Build parts array preserving interleaved order (text is already in orderedParts)
          const parts: MessagePart[] = [...orderedParts];

          // Add current in-progress reasoning if any (it will be finalized and added to orderedParts at end)
          if (currentReasoningText && currentReasoningId) {
            const existingIndex = parts.findIndex(
              (p) =>
                p.type === "reasoning" &&
                (p as { id?: string }).id === currentReasoningId
            );
            if (existingIndex === -1) {
              parts.push({
                type: "reasoning" as const,
                text: currentReasoningText,
              });
            } else {
              (parts[existingIndex] as { text: string }).text =
                currentReasoningText;
            }
          }

          // Update assistant message with accumulated parts (only if still viewing this conversation)
          if (conversationIdRef.current === convId) {
            setMessages((prev) => {
              const updated = prev.map((msg, i) => {
                if (i === prev.length - 1 && msg.role === "assistant") {
                  return {
                    ...msg,
                    parts,
                  };
                }
                return msg;
              });
              return updated;
            });
          }

          // Always update snapshot regardless of current view (for restoration when navigating back)
          if (streamingMessagesSnapshotRef.current?.conversationId === convId) {
            streamingMessagesSnapshotRef.current.messages =
              streamingMessagesSnapshotRef.current.messages.map((msg, i) => {
                if (
                  i ===
                    streamingMessagesSnapshotRef.current!.messages.length - 1 &&
                  msg.role === "assistant"
                ) {
                  return { ...msg, parts };
                }
                return msg;
              });
          }
        }

        // Finalize any remaining reasoning at the end
        finalizeCurrentReasoning();

        // Clear interval and do final persistence with complete parts and metadata
        if (streamingInterval) {
          clearInterval(streamingInterval);
          streamingInterval = null;
        }

        // Final update with complete parts and thinking duration metadata
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
            parts: [...orderedParts],
            metadata:
              Object.keys(finalMetadata).length > 0 ? finalMetadata : undefined,
          }).catch((err) => {
            console.warn("Failed to finalize streaming message:", err);
          });
        }

        // Clear streaming state (always update - this is global bookkeeping)
        setStreamingConversationId(null);
        // Clear snapshot - streaming is done
        streamingMessagesSnapshotRef.current = null;

        return {
          fullText,
          aborted: false,
          orderedParts: [...orderedParts],
          totalThinkingDuration,
          assistantMessageId,
        };
      } catch (err) {
        // Clear interval on error/abort
        if (streamingInterval) {
          clearInterval(streamingInterval);
          streamingInterval = null;
        }

        if ((err as Error).name === "AbortError") {
          // Finalize any pending content and return actual parts
          finalizeCurrentReasoning();
          finalizeCurrentText();

          // Clear streaming state (always update - this is global bookkeeping)
          setStreamingConversationId(null);
          // Clear snapshot - streaming is done
          streamingMessagesSnapshotRef.current = null;

          // Persist aborted state with partial content
          if (shouldPersist) {
            const abortedMetadata = {
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
              parts: [...orderedParts],
              metadata:
                Object.keys(abortedMetadata).length > 0
                  ? abortedMetadata
                  : undefined,
            }).catch((err) => {
              console.warn("Failed to persist aborted message:", err);
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

        // For non-abort errors, still persist partial content to avoid orphaned DB records
        finalizeCurrentReasoning();
        finalizeCurrentText();

        // Clear streaming state (always update - this is global bookkeeping)
        setStreamingConversationId(null);
        // Clear snapshot - streaming is done
        streamingMessagesSnapshotRef.current = null;

        if (shouldPersist && orderedParts.length > 0) {
          const errorMetadata = {
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
            parts: [...orderedParts],
            metadata:
              Object.keys(errorMetadata).length > 0 ? errorMetadata : undefined,
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
      // Ensure user is authenticated (signs in anonymously if needed)
      const authSuccess = await ensureAuthenticated();
      if (!authSuccess) {
        toast.error("Authentication failed", {
          description:
            "Could not establish a session. Please refresh the page.",
        });
        return;
      }

      // Get current core names for metadata
      const coreNames = getActiveCoreNames?.() ?? [];

      // Parse input into user message with model and metadata
      const userMessage: UIMessage =
        typeof input === "string"
          ? {
              id: crypto.randomUUID(),
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
              id: crypto.randomUUID(),
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

      // Create conversation if needed (all users now have real IDs)
      let convId = conversationIdRef.current;
      if (!convId) {
        convId = await createConversation({ model });
        onConversationCreate?.(convId);
      }

      // Get current messages and add user message to local state
      const currentMessages = messagesRef.current;
      const updatedMessages = [...currentMessages, userMessage];

      // Track this conversation as streaming and update UI (only if still viewing it)
      if (conversationIdRef.current === convId) {
        setMessages(updatedMessages);
        setStatus("submitted");
        setStreamingConversationId(convId);
      }
      setError(null);

      // Save user message immediately (all users have real IDs now)
      await appendMessage({
        conversationId: convId as Id<"conversations">,
        message: {
          id: userMessage.id,
          role: userMessage.role,
          parts: userMessage.parts,
          model: userMessage.model,
          createdAt:
            userMessage.createdAt instanceof Date
              ? userMessage.createdAt.getTime()
              : userMessage.createdAt,
          metadata: userMessage.metadata,
        },
      });

      // Generate title for new conversations right after first message is sent
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
        // Stream the response with 250ms persistence interval
        // Assistant message is created and updated in DB by streamResponse
        const {
          aborted,
          orderedParts,
          totalThinkingDuration,
          assistantMessageId,
        } = await streamResponse(
          updatedMessages,
          convId,
          controller,
          undefined, // modelOverride
          undefined, // reasoningLevelOverride
          options?.webSearchEnabled,
          { coreNames, persistToDb: true }
        );

        // Build final assistant message for UI state
        const assistantMessage: UIMessage = {
          id: assistantMessageId,
          role: "assistant",
          parts: [...orderedParts],
          model,
          createdAt: new Date(),
          metadata: {
            coreNames,
            ...(reasoningLevel !== undefined && { reasoningLevel }),
            ...(totalThinkingDuration > 0 && {
              thinkingDuration: totalThinkingDuration,
            }),
          },
        };

        // Update local state with final assistant message (only if still viewing this conversation)
        if (conversationIdRef.current === convId) {
          const finalMessages = [...updatedMessages, assistantMessage];
          setMessages(finalMessages);
        }
        // Always update completion state (global bookkeeping)
        setStatus("ready");
        setStreamingConversationId(null);
      } catch (err) {
        // On error, revert to state before the assistant placeholder was added
        // Keep the user message so they can see what they tried to send (only if still viewing)
        if (conversationIdRef.current === convId) {
          setMessages(updatedMessages);
        }
        // Always update error state (global bookkeeping)
        setError(err as Error);
        setStatus("error");
        setStreamingConversationId(null);
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
      ensureAuthenticated,
    ]
  );

  /**
   * Stop the current generation and save partial response
   */
  const stop = useCallback(async () => {
    if (abortController) {
      abortController.abort();
      // The streamResponse will return with aborted: true
      // and sendMessage/regenerate will save the partial content
    }
  }, [abortController]);

  /**
   * Regenerate the assistant response
   * Creates a new user message copy (for token tracking) and new assistant response
   * Optionally accepts model and reasoningLevel overrides for the regeneration
   */
  const regenerate = useCallback(
    async (options?: {
      messageId?: string;
      model?: string;
      reasoningLevel?: string | number;
    }) => {
      const currentMessages = messagesRef.current;
      const convId = conversationIdRef.current;

      if (!convId) return;

      // Use override model/reasoningLevel if provided, otherwise use current values
      const regenModel = options?.model ?? model;
      const regenReasoningLevel = options?.reasoningLevel ?? reasoningLevel;

      // Get current core names for metadata
      const coreNames = getActiveCoreNames?.() ?? [];

      // Find the message to regenerate from
      let targetIndex = currentMessages.length - 1;

      if (options?.messageId) {
        targetIndex = currentMessages.findIndex(
          (m) => m.id === options.messageId
        );
        if (targetIndex === -1) return;
      }

      // Find the assistant message at or before targetIndex
      while (
        targetIndex >= 0 &&
        currentMessages[targetIndex].role !== "assistant"
      ) {
        targetIndex--;
      }

      if (targetIndex < 0) return;

      // Find the user message that prompted this assistant response
      let userMessageIndex = targetIndex - 1;
      while (
        userMessageIndex >= 0 &&
        currentMessages[userMessageIndex].role !== "user"
      ) {
        userMessageIndex--;
      }

      if (userMessageIndex < 0) return;

      const userMessageToRegen = currentMessages[userMessageIndex];

      // Keep messages before the user message (we'll create new copies of user + assistant)
      const messagesBeforeUser = currentMessages.slice(0, userMessageIndex);

      // Create a new copy of the user message (for token tracking)
      const newUserMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: userMessageToRegen.parts,
        model: regenModel,
        createdAt: new Date(),
        metadata: {
          coreNames,
          ...(regenReasoningLevel !== undefined && {
            reasoningLevel: regenReasoningLevel,
          }),
        },
      };

      const messagesWithNewUser = [...messagesBeforeUser, newUserMessage];

      // Track this conversation as streaming and update UI (only if still viewing it)
      if (conversationIdRef.current === convId) {
        setMessages(messagesWithNewUser);
        setStatus("submitted");
        setStreamingConversationId(convId);
      }
      setError(null);

      // Soft-delete the old user message and assistant message (and any after)
      await truncateFrom({
        conversationId: convId as Id<"conversations">,
        fromMessageId: userMessageToRegen.id,
      });

      // Save the new user message immediately (for token tracking)
      await appendMessage({
        conversationId: convId as Id<"conversations">,
        message: {
          id: newUserMessage.id,
          role: newUserMessage.role,
          parts: newUserMessage.parts,
          model: newUserMessage.model,
          createdAt:
            newUserMessage.createdAt instanceof Date
              ? newUserMessage.createdAt.getTime()
              : newUserMessage.createdAt,
          metadata: newUserMessage.metadata,
        },
      });

      // Create abort controller
      const controller = new AbortController();
      setAbortController(controller);

      try {
        // Stream a new response with 250ms persistence interval
        const { orderedParts, totalThinkingDuration, assistantMessageId } =
          await streamResponse(
            messagesWithNewUser,
            convId,
            controller,
            regenModel,
            regenReasoningLevel,
            undefined, // webSearchEnabled
            { coreNames, persistToDb: true }
          );

        // Build new assistant message for UI state
        const assistantMessage: UIMessage = {
          id: assistantMessageId,
          role: "assistant",
          parts: [...orderedParts],
          model: regenModel,
          createdAt: new Date(),
          metadata: {
            coreNames,
            ...(regenReasoningLevel !== undefined && {
              reasoningLevel: regenReasoningLevel,
            }),
            ...(totalThinkingDuration > 0 && {
              thinkingDuration: totalThinkingDuration,
            }),
          },
        };

        // Update local state (only if still viewing this conversation)
        if (conversationIdRef.current === convId) {
          const finalMessages = [...messagesWithNewUser, assistantMessage];
          setMessages(finalMessages);
        }
        // Always update completion state (global bookkeeping)
        setStatus("ready");
        setStreamingConversationId(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          if (conversationIdRef.current === convId) {
            setError(err as Error);
          }
          // Always update error state (global bookkeeping)
          setStatus("error");
          setStreamingConversationId(null);
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
   * Edit a user message and resend
   * Optionally accepts config overrides (model, reasoningLevel, webSearchEnabled)
   */
  const editAndResend = useCallback(
    async (
      messageId: string,
      newContent: string,
      attachments?: FilePart[],
      options?: {
        model?: string;
        reasoningLevel?: string | number;
        webSearchEnabled?: boolean;
      }
    ) => {
      const currentMessages = messagesRef.current;
      const convId = conversationIdRef.current;

      if (!convId) return;

      // Get current core names for metadata
      const coreNames = getActiveCoreNames?.() ?? [];

      const messageIndex = currentMessages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      const message = currentMessages[messageIndex];
      if (message.role !== "user") return;

      // Keep messages before the edited one
      const messagesBefore = currentMessages.slice(0, messageIndex);

      // Use override config if provided, otherwise fall back to original message settings
      const editModel = options?.model ?? message.model ?? model;
      const editReasoningLevel =
        options?.reasoningLevel ??
        message.metadata?.reasoningLevel ??
        reasoningLevel;
      const editWebSearchEnabled =
        options?.webSearchEnabled ??
        message.metadata?.webSearchEnabled ??
        false;

      // Use provided attachments, or fall back to original file parts
      const fileParts =
        attachments ??
        (message.parts.filter((p) => p.type === "file") as FilePart[]);

      // Build parts array: text first (if any), then attachments
      const parts: MessagePart[] = [];
      if (newContent.trim()) {
        parts.push({ type: "text", text: newContent });
      }
      parts.push(...fileParts);

      // Create edited user message with config (overrides or original)
      const editedMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts,
        model: editModel,
        createdAt: new Date(),
        metadata: {
          coreNames,
          ...(editReasoningLevel !== undefined && {
            reasoningLevel: editReasoningLevel,
          }),
          ...(editWebSearchEnabled && { webSearchEnabled: true }),
        },
      };

      const messagesWithEdited = [...messagesBefore, editedMessage];

      // Track this conversation as streaming and update UI (only if still viewing it)
      if (conversationIdRef.current === convId) {
        setMessages(messagesWithEdited);
        setStatus("submitted");
        setStreamingConversationId(convId);
      }
      setError(null);

      // Delete the original user message and everything after it from DB
      await truncateFrom({
        conversationId: convId as Id<"conversations">,
        fromMessageId: messageId,
      });

      // Save new user message immediately
      await appendMessage({
        conversationId: convId as Id<"conversations">,
        message: {
          id: editedMessage.id,
          role: editedMessage.role,
          parts: editedMessage.parts,
          model: editedMessage.model,
          createdAt:
            editedMessage.createdAt instanceof Date
              ? editedMessage.createdAt.getTime()
              : editedMessage.createdAt,
          metadata: editedMessage.metadata,
        },
      });

      // Create abort controller
      const controller = new AbortController();
      setAbortController(controller);

      try {
        // Stream response for edited message with 250ms persistence interval
        const { orderedParts, totalThinkingDuration, assistantMessageId } =
          await streamResponse(
            messagesWithEdited,
            convId,
            controller,
            editModel,
            editReasoningLevel,
            editWebSearchEnabled,
            { coreNames, persistToDb: true }
          );

        // Build assistant message for UI state
        const assistantMessage: UIMessage = {
          id: assistantMessageId,
          role: "assistant",
          parts: [...orderedParts],
          model: editModel,
          createdAt: new Date(),
          metadata: {
            coreNames,
            ...(editReasoningLevel !== undefined && {
              reasoningLevel: editReasoningLevel,
            }),
            ...(totalThinkingDuration > 0 && {
              thinkingDuration: totalThinkingDuration,
            }),
          },
        };

        // Update local state (only if still viewing this conversation)
        if (conversationIdRef.current === convId) {
          const finalMessages = [...messagesWithEdited, assistantMessage];
          setMessages(finalMessages);
        }
        // Always update completion state (global bookkeeping)
        setStatus("ready");
        setStreamingConversationId(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          if (conversationIdRef.current === convId) {
            setError(err as Error);
          }
          // Always update error state (global bookkeeping)
          setStatus("error");
          setStreamingConversationId(null);
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
   * Fork a conversation at a specific message
   * Creates a new conversation with messages up to that point
   * Server queries messages directly from DB (more secure and gets complete data including tokens)
   */
  const forkConversation = useCallback(
    async (messageId: string): Promise<string | null> => {
      const convId = conversationIdRef.current;

      if (!convId) return null;

      try {
        // Create forked conversation - server will query messages directly from DB
        const newConvId = await forkConversationMutation({
          sourceConversationId: convId as Id<"conversations">,
          forkedAtMessageId: messageId,
        });

        return newConvId;
      } catch (err) {
        setError(err as Error);
        return null;
      }
    },
    [forkConversationMutation]
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Compute effective status for the current conversation
  // If streaming is happening for a different conversation, this conversation is "ready"
  const effectiveStatus: ChatStatus =
    streamingConversationId &&
    streamingConversationId !== conversationId &&
    (status === "streaming" || status === "submitted")
      ? "ready"
      : status;

  return {
    messages,
    status: effectiveStatus,
    error,
    sendMessage,
    stop,
    regenerate,
    editAndResend,
    forkConversation,
    setMessages,
    clearError,
  };
}
