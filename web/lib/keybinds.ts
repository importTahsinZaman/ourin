/**
 * Keybind configuration types and defaults
 */

export type KeybindAction =
  | "toggleSidebarLeft" // Used when sidebar is on left
  | "toggleSidebarRight" // Used when sidebar is on right
  | "newChat"
  | "settings"
  | "appearance"
  | "commandPalette";

export interface KeybindConfig {
  key: string; // The key (e.g., "[", "n", "k")
  meta?: boolean; // Cmd (Mac) / Ctrl (Windows)
  shift?: boolean;
  alt?: boolean;
}

export type KeybindsMap = Record<KeybindAction, KeybindConfig>;

export const KEYBIND_LABELS: Record<KeybindAction, string> = {
  toggleSidebarLeft: "Toggle Sidebar (Left Layout)",
  toggleSidebarRight: "Toggle Sidebar (Right Layout)",
  newChat: "New Chat",
  settings: "Settings",
  appearance: "Appearance",
  commandPalette: "Command Palette",
};

export const DEFAULT_KEYBINDS: KeybindsMap = {
  toggleSidebarLeft: { key: "[" },
  toggleSidebarRight: { key: "]" },
  newChat: { key: "n", meta: true },
  settings: { key: ",", meta: true },
  appearance: { key: "t" },
  commandPalette: { key: "k", meta: true },
};

// Reserved system shortcuts that should not be overridden
export const RESERVED_SHORTCUTS: KeybindConfig[] = [
  { key: "c", meta: true }, // Copy
  { key: "v", meta: true }, // Paste
  { key: "x", meta: true }, // Cut
  { key: "a", meta: true }, // Select all
  { key: "z", meta: true }, // Undo
  { key: "z", meta: true, shift: true }, // Redo
  { key: "w", meta: true }, // Close tab
  { key: "q", meta: true }, // Quit
  { key: "r", meta: true }, // Refresh
  { key: "t", meta: true }, // New tab
  { key: "f", meta: true }, // Find
];

/**
 * Check if a keybind matches a reserved shortcut
 */
export function isReservedShortcut(config: KeybindConfig): boolean {
  return RESERVED_SHORTCUTS.some(
    (reserved) =>
      reserved.key.toLowerCase() === config.key.toLowerCase() &&
      !!reserved.meta === !!config.meta &&
      !!reserved.shift === !!config.shift &&
      !!reserved.alt === !!config.alt
  );
}

/**
 * Format a keybind config to a display string
 * e.g., { key: "k", meta: true } -> "⌘K" (Mac) or "Ctrl+K" (Windows)
 */
export function formatKeybind(
  config: KeybindConfig | undefined,
  isMac = true
): string {
  if (!config?.key) return "";

  const parts: string[] = [];

  if (config.meta) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (config.alt) {
    parts.push(isMac ? "⌥" : "Alt");
  }
  if (config.shift) {
    parts.push(isMac ? "⇧" : "Shift");
  }

  // Format the key
  let keyDisplay = config.key.toUpperCase();
  if (config.key === "[") keyDisplay = "[";
  if (config.key === "]") keyDisplay = "]";
  if (config.key === ",") keyDisplay = ",";
  if (config.key === ".") keyDisplay = ".";
  if (config.key === "/") keyDisplay = "/";
  if (config.key === "Escape") keyDisplay = "Esc";
  if (config.key === " ") keyDisplay = "Space";

  parts.push(keyDisplay);

  return isMac ? parts.join("") : parts.join("+");
}

/**
 * Check if a keyboard event matches a keybind config
 */
export function matchesKeybind(
  event: KeyboardEvent,
  config: KeybindConfig | undefined
): boolean {
  if (!config?.key || !event.key) return false;

  const metaPressed = event.metaKey || event.ctrlKey;
  const shiftPressed = event.shiftKey;
  const altPressed = event.altKey;

  return (
    event.key.toLowerCase() === config.key.toLowerCase() &&
    !!config.meta === metaPressed &&
    !!config.shift === shiftPressed &&
    !!config.alt === altPressed
  );
}

/**
 * Parse a KeyboardEvent into a KeybindConfig
 */
export function eventToKeybindConfig(event: KeyboardEvent): KeybindConfig {
  const config: KeybindConfig = {
    key: event.key,
  };

  if (event.metaKey || event.ctrlKey) {
    config.meta = true;
  }
  if (event.shiftKey) {
    config.shift = true;
  }
  if (event.altKey) {
    config.alt = true;
  }

  return config;
}

/**
 * Check if two keybind configs are equal
 */
export function keybindsEqual(a: KeybindConfig, b: KeybindConfig): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    !!a.meta === !!b.meta &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  );
}

/**
 * Merge user overrides with defaults
 */
export function mergeKeybinds(
  overrides: Partial<KeybindsMap> | null | undefined
): KeybindsMap {
  if (!overrides) return { ...DEFAULT_KEYBINDS };
  return { ...DEFAULT_KEYBINDS, ...overrides };
}

/**
 * Serialize keybinds to JSON string (only non-default values)
 */
export function serializeKeybinds(keybinds: KeybindsMap): string {
  const overrides: Partial<KeybindsMap> = {};

  for (const [action, config] of Object.entries(keybinds)) {
    const defaultConfig = DEFAULT_KEYBINDS[action as KeybindAction];
    if (!keybindsEqual(config, defaultConfig)) {
      overrides[action as KeybindAction] = config;
    }
  }

  return JSON.stringify(overrides);
}

/**
 * Parse keybinds from JSON string
 */
export function parseKeybinds(json: string | null | undefined): KeybindsMap {
  if (!json) return { ...DEFAULT_KEYBINDS };

  try {
    const overrides = JSON.parse(json) as Partial<KeybindsMap>;
    return mergeKeybinds(overrides);
  } catch {
    return { ...DEFAULT_KEYBINDS };
  }
}

/**
 * LocalStorage key for anonymous user keybinds
 */
export const KEYBINDS_STORAGE_KEY = "ourin-keybinds";
