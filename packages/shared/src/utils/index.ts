/**
 * shared utility functions used by both web and mobile apps.
 * these are platform-agnostic and don't depend on browser/node specific apis.
 */

/**
 * format a date relative to now (today, yesterday, etc.)
 */
export function formatRelativeDate(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return "Today";
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return "Last 7 days";
  } else if (days < 30) {
    return "Last 30 days";
  } else {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
}

/**
 * group items by a key function
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

/**
 * truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * generate a random id using crypto.randomUUID
 * works in both browser and react native (with polyfill)
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * check if a file type is an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * check if a file type is a pdf
 */
export function isPdfFile(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

/**
 * get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * detect if a hex color is light or dark based on relative luminance.
 * supports both 3-digit (#rgb) and 6-digit (#rrggbb) hex formats.
 */
export function isLightColor(hex: string): boolean {
  // remove # if present
  const cleanHex = hex.replace(/^#/, "");

  let r: number, g: number, b: number;

  if (cleanHex.length === 3) {
    // 3-digit hex: #rgb -> #rrggbb
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    // 6-digit hex: #rrggbb
    r = parseInt(cleanHex.slice(0, 2), 16);
    g = parseInt(cleanHex.slice(2, 4), 16);
    b = parseInt(cleanHex.slice(4, 6), 16);
  } else {
    // invalid format, default to light
    return true;
  }

  // check for nan (invalid hex characters)
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return true;
  }

  // using relative luminance formula (itu-r bt.601)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * validate a hex color string.
 * returns true if valid 3-digit or 6-digit hex (with or without #).
 */
export function isValidHexColor(hex: string): boolean {
  return /^#?([a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/.test(hex);
}
