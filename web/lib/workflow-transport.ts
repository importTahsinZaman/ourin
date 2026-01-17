/**
 * WDK run ID management for stream resumption.
 * Stores active workflow run IDs in localStorage per conversation.
 */

const ACTIVE_RUN_KEY = "ourin-active-workflow-run";

export function getActiveRunId(conversationId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${ACTIVE_RUN_KEY}:${conversationId}`);
}

export function setActiveRunId(conversationId: string, runId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${ACTIVE_RUN_KEY}:${conversationId}`, runId);
}

export function clearActiveRunId(conversationId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${ACTIVE_RUN_KEY}:${conversationId}`);
}
