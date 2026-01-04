/**
 * Color utility functions for deriving colors from theme base colors.
 * Used to create consistent secondary colors throughout the app.
 */

/**
 * Convert hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

/**
 * Add alpha/opacity to a hex color
 */
export function withOpacity(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/**
 * Lighten a color by a percentage
 */
export function lighten(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = percent / 100;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}

/**
 * Darken a color by a percentage
 */
export function darken(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - percent / 100;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

/**
 * Mix two colors together
 */
export function mix(hex1: string, hex2: string, weight: number = 0.5): string {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return hex1;
  return rgbToHex(
    rgb1.r * weight + rgb2.r * (1 - weight),
    rgb1.g * weight + rgb2.g * (1 - weight),
    rgb1.b * weight + rgb2.b * (1 - weight)
  );
}

/**
 * Check if a color is light or dark
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  // Using relative luminance formula
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5;
}

/**
 * Generate derived colors from base theme colors
 */
export function getDerivedColors(theme: {
  background: string;
  text: string;
  accent: string;
  type: "light" | "dark";
}) {
  const isLight = theme.type === "light";

  return {
    // Backgrounds
    background: theme.background,
    backgroundSecondary: isLight
      ? darken(theme.background, 4)
      : lighten(theme.background, 6),
    backgroundTertiary: isLight
      ? darken(theme.background, 8)
      : lighten(theme.background, 10),
    backgroundElevated: isLight
      ? theme.background
      : lighten(theme.background, 4),
    backgroundHover: mix(theme.accent, theme.background, isLight ? 0.08 : 0.12),

    // Text
    text: theme.text,
    textSecondary: isLight ? lighten(theme.text, 35) : darken(theme.text, 30),
    textMuted: isLight ? lighten(theme.text, 50) : darken(theme.text, 45),
    textTertiary: isLight ? lighten(theme.text, 60) : darken(theme.text, 55),

    // Accent
    accent: theme.accent,
    accentHover: isLight ? darken(theme.accent, 10) : lighten(theme.accent, 10),
    accentMuted: withOpacity(theme.accent, isLight ? 0.15 : 0.2),

    // Borders
    border: withOpacity(theme.text, isLight ? 0.12 : 0.15),
    borderMuted: withOpacity(theme.text, isLight ? 0.06 : 0.08),

    // Status colors (these stay consistent)
    error: "#ef4444",
    success: "#22c55e",
    warning: "#f59e0b",
  };
}
