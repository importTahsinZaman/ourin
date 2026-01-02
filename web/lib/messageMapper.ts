import type { UIMessage, MessagePart, MessageMetadata } from "@/types/chat";

/**
 * raw message format from convex queries (api.messages.getByConversation).
 * this matches the return type of the getByConversation query.
 */
export interface ConvexMessage {
  id: string;
  role: string;
  parts: MessagePart[];
  model?: string;
  createdAt?: number;
  metadata?: MessageMetadata;
}

// type guard to validate message role
function isValidRole(role: string): role is UIMessage["role"] {
  return role === "user" || role === "assistant" || role === "system";
}

/**
 * convert a single convex message to uimessage format.
 * handles type conversions:
 * - role: string -> "user" | "assistant" | "system"
 * - createdAt: number (timestamp) -> date
 */
export function toUIMessage(message: ConvexMessage): UIMessage {
  if (!isValidRole(message.role)) {
    console.error(
      `invalid message role: ${message.role}, defaulting to 'user'`
    );
  }
  return {
    id: message.id,
    role: isValidRole(message.role) ? message.role : "user",
    parts: message.parts,
    model: message.model,
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
    metadata: message.metadata,
  };
}

/**
 * convert an array of convex messages to uimessage format.
 */
export function toUIMessages(messages: ConvexMessage[]): UIMessage[] {
  return messages.map(toUIMessage);
}
