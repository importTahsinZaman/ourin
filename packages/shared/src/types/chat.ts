/**
 * shared chat types used by both web and mobile apps.
 * these types are platform-agnostic and don't depend on convex.
 */

export interface TextPart {
  type: "text";
  text: string;
}

export interface FilePart {
  type: "file";
  mediaType: string;
  url?: string;
  storageId?: string; // generic string, apps can cast to their Id type
  fileName: string;
  fileSize?: number;
}

export interface ReasoningPart {
  type: "reasoning";
  text: string;
  id?: string; // for tracking separate reasoning blocks in interleaved thinking
  duration?: number; // duration in seconds this block took to generate
}

export interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocationId: string;
  toolName: string;
  args: unknown;
  state: "call" | "result";
  result?: unknown;
}

export interface WebSearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface SourcesPart {
  type: "sources";
  sources: WebSearchSource[];
}

export type MessagePart =
  | TextPart
  | FilePart
  | ReasoningPart
  | ToolInvocationPart
  | SourcesPart;

export interface MessageMetadata {
  coreNames?: string[];
  reasoningLevel?: string | number;
  thinkingDuration?: number; // duration in seconds the model spent thinking
  webSearchEnabled?: boolean;
  [key: string]: unknown;
}

export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  model?: string; // model used for this message
  createdAt?: Date;
  metadata?: MessageMetadata;
}

export interface ModelInfo {
  id: string;
  apiModelId: string;
  name: string;
  provider: "google" | "anthropic" | "openai";
  isReasoning: boolean;
  reasoningParameter?: {
    paramName: string;
    structure?: {
      type: string;
      budget_tokens: number;
    };
    options?: string[];
  };
  releaseDate: number;
}

/**
 * base conversation interface without convex-specific Id types.
 * web app extends this with proper Id types.
 */
export interface BaseConversation {
  _id: string;
  userId: string;
  title?: string;
  model?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  forkedFrom?: string;
  forkedAtMessageId?: string;
}
