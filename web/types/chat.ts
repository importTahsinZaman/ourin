import type { Id } from "@/convex/_generated/dataModel";

export interface TextPart {
  type: "text";
  text: string;
}

export interface FilePart {
  type: "file";
  mediaType: string;
  url?: string;
  storageId?: Id<"_storage">;
  fileName: string;
  fileSize?: number;
}

export interface ReasoningPart {
  type: "reasoning";
  text: string;
  id?: string; // For tracking separate reasoning blocks in interleaved thinking
  duration?: number; // Duration in seconds this block took to generate
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
  thinkingDuration?: number; // Duration in seconds the model spent thinking
  webSearchEnabled?: boolean;
  [key: string]: unknown;
}

export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  model?: string; // Model used for this message
  createdAt?: Date;
  metadata?: MessageMetadata;
}

export interface Conversation {
  _id: Id<"conversations">;
  userId: Id<"users">;
  title?: string;
  model?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  forkedFrom?: Id<"conversations">;
  forkedAtMessageId?: string;
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
