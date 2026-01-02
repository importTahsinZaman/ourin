import { cookies } from "next/headers";
import { HomeClient } from "@/components/home/HomeClient";

const SIDEBAR_COLLAPSED_COOKIE = "ourin-sidebar-collapsed";
const SIDEBAR_WIDTH_COOKIE = "ourin-sidebar-width";
const SIDEBAR_SIDE_COOKIE = "ourin-sidebar-side";
const THEME_EDITOR_OPEN_COOKIE = "ourin-theme-editor-open";
const ACTIVE_CORES_COUNT_COOKIE = "ourin-active-cores-count";
const SELECTED_MODEL_COOKIE = "ourin-selected-model";
const REASONING_LEVEL_COOKIE = "ourin-reasoning-level";
const WEB_SEARCH_ENABLED_COOKIE = "ourin-web-search-enabled";
const USER_TIER_COOKIE = "ourin-user-tier";

const DEFAULT_SIDEBAR_WIDTH = 307;
const DEFAULT_ACTIVE_CORES_COUNT = 2;
const DEFAULT_MODEL = "google:gemini-2.5-flash-lite";

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const [{ id }, cookieStore] = await Promise.all([params, cookies()]);
  const sidebarCollapsed =
    cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "true";
  const sidebarWidthStr = cookieStore.get(SIDEBAR_WIDTH_COOKIE)?.value;
  const sidebarWidth = sidebarWidthStr
    ? parseInt(sidebarWidthStr, 10)
    : DEFAULT_SIDEBAR_WIDTH;
  const sidebarSide = (
    cookieStore.get(SIDEBAR_SIDE_COOKIE)?.value === "right" ? "right" : "left"
  ) as "left" | "right";
  const themeEditorOpen =
    cookieStore.get(THEME_EDITOR_OPEN_COOKIE)?.value === "true";
  const activeCoresCountStr = cookieStore.get(ACTIVE_CORES_COUNT_COOKIE)?.value;
  const activeCoresCount = activeCoresCountStr
    ? parseInt(activeCoresCountStr, 10)
    : DEFAULT_ACTIVE_CORES_COUNT;
  const selectedModel =
    cookieStore.get(SELECTED_MODEL_COOKIE)?.value || DEFAULT_MODEL;
  const reasoningLevelStr = cookieStore.get(REASONING_LEVEL_COOKIE)?.value;
  // parse as number if it looks like a number (for budget-based models like claude)
  const reasoningLevel = reasoningLevelStr
    ? /^\d+$/.test(reasoningLevelStr)
      ? parseInt(reasoningLevelStr, 10)
      : reasoningLevelStr
    : undefined;
  const webSearchEnabled =
    cookieStore.get(WEB_SEARCH_ENABLED_COOKIE)?.value === "true";
  const userTier = cookieStore.get(USER_TIER_COOKIE)?.value;

  return (
    <HomeClient
      initialConversationId={id}
      initialSidebarCollapsed={sidebarCollapsed}
      initialSidebarWidth={sidebarWidth}
      initialSidebarSide={sidebarSide}
      initialThemeEditorOpen={themeEditorOpen}
      initialActiveCoresCount={activeCoresCount}
      initialSelectedModel={selectedModel}
      initialReasoningLevel={reasoningLevel}
      initialWebSearchEnabled={webSearchEnabled}
      initialUserTier={userTier}
    />
  );
}
