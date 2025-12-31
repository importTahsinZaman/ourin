const STORAGE_KEY = "ourin-theme-usage";

interface ThemeUsageMap {
  [themeId: string]: number; // timestamp
}

export function getThemeUsageTimestamps(): ThemeUsageMap {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function recordThemeUsage(themeId: string): void {
  if (typeof window === "undefined") return;
  try {
    const timestamps = getThemeUsageTimestamps();
    timestamps[themeId] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
  } catch {
    // Ignore storage errors
  }
}
