import type { OurinTheme } from "../types/theme";

// ============================================================================
// Color Utility Functions
// ============================================================================

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

function lighten(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const amount = (percent / 100) * 255;
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
}

function darken(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const amount = (percent / 100) * 255;
  return rgbToHex(rgb.r - amount, rgb.g - amount, rgb.b - amount);
}

function withOpacity(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function mix(hex1: string, hex2: string, weight: number = 0.5): string {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return hex1;
  return rgbToHex(
    rgb1.r * weight + rgb2.r * (1 - weight),
    rgb1.g * weight + rgb2.g * (1 - weight),
    rgb1.b * weight + rgb2.b * (1 - weight)
  );
}

// ============================================================================
// CSS Variable Generation
// ============================================================================

/**
 * Generate all CSS variables from 3 base colors
 */
function deriveAllColors(
  background: string,
  text: string,
  accent: string,
  type: "light" | "dark"
): string[] {
  const isLight = type === "light";
  const vars: string[] = [];

  // Background variations
  const bgSecondary = isLight ? darken(background, 2) : lighten(background, 3);
  const bgTertiary = isLight ? darken(background, 4) : lighten(background, 5);
  const bgElevated = isLight ? lighten(background, 2) : lighten(background, 4);
  // Hover/active colors incorporate accent for a subtle tint
  const bgHover = isLight
    ? darken(mix(background, accent, 0.92), 2)
    : lighten(mix(background, accent, 0.88), 4);
  const bgActive = isLight
    ? darken(mix(background, accent, 0.88), 3)
    : lighten(mix(background, accent, 0.84), 6);
  const bgInput = isLight ? darken(background, 1) : lighten(background, 2);

  vars.push(`--color-background-primary: ${background};`);
  vars.push(`--color-background-secondary: ${bgSecondary};`);
  vars.push(`--color-background-tertiary: ${bgTertiary};`);
  vars.push(`--color-background-elevated: ${bgElevated};`);
  vars.push(`--color-background-input: ${bgInput};`);
  vars.push(`--color-background-hover: ${bgHover};`);
  vars.push(`--color-background-active: ${bgActive};`);

  // Text variations
  const textSecondary = isLight ? lighten(text, 25) : darken(text, 20);
  const textMuted = isLight ? lighten(text, 40) : darken(text, 35);
  const textTertiary = isLight ? lighten(text, 50) : darken(text, 45);
  const textInverse = background;
  const textLink = accent;
  const textLinkHover = isLight ? darken(accent, 10) : lighten(accent, 10);

  vars.push(`--color-text-primary: ${text};`);
  vars.push(`--color-text-secondary: ${textSecondary};`);
  vars.push(`--color-text-muted: ${textMuted};`);
  vars.push(`--color-text-tertiary: ${textTertiary};`);
  vars.push(`--color-text-inverse: ${textInverse};`);
  vars.push(`--color-text-link: ${textLink};`);
  vars.push(`--color-text-link-hover: ${textLinkHover};`);

  // Accent variations
  const accentHover = isLight ? darken(accent, 8) : lighten(accent, 8);
  const accentMuted = withOpacity(accent, isLight ? 0.1 : 0.15);

  vars.push(`--color-accent-primary: ${accent};`);
  vars.push(`--color-accent-primary-hover: ${accentHover};`);
  vars.push(`--color-accent-primary-muted: ${accentMuted};`);

  // Border colors (derived from text with opacity)
  const borderDefault = isLight
    ? withOpacity(text, 0.12)
    : withOpacity(text, 0.15);
  const borderMuted = isLight
    ? withOpacity(text, 0.06)
    : withOpacity(text, 0.08);

  vars.push(`--color-border-default: ${borderDefault};`);
  vars.push(`--color-border-muted: ${borderMuted};`);
  vars.push(`--color-border-focus: ${accent};`);
  vars.push(`--color-border-accent: ${accent};`);

  // Message colors
  const userMsgBg = isLight
    ? mix(background, accent, 0.85)
    : mix(background, accent, 0.9);

  vars.push(`--color-message-user-background: ${userMsgBg};`);
  vars.push(`--color-message-user-text: ${text};`);
  vars.push(`--color-message-user-border: transparent;`);
  vars.push(`--color-message-assistant-background: transparent;`);
  vars.push(
    `--color-message-assistant-text: ${isLight ? darken(text, 5) : lighten(text, 5)};`
  );
  vars.push(`--color-message-assistant-border: transparent;`);

  // Button colors
  vars.push(`--color-button-primary-background: ${accent};`);
  vars.push(`--color-button-primary-background-hover: ${accentHover};`);
  vars.push(`--color-button-primary-text: ${textInverse};`);
  vars.push(`--color-button-secondary-background: ${bgTertiary};`);
  vars.push(`--color-button-secondary-background-hover: ${bgHover};`);
  vars.push(`--color-button-secondary-text: ${text};`);
  vars.push(`--color-button-secondary-border: ${borderDefault};`);
  vars.push(`--color-button-ghost-background: transparent;`);
  vars.push(
    `--color-button-ghost-background-hover: ${isLight ? withOpacity(text, 0.06) : withOpacity(text, 0.08)};`
  );
  vars.push(`--color-button-ghost-text: ${textSecondary};`);

  // Code block
  const codeBg = isLight ? darken(background, 4) : lighten(background, 6);

  vars.push(`--color-code-background: ${codeBg};`);
  vars.push(`--color-code-text: ${text};`);
  vars.push(`--color-code-border: ${borderMuted};`);

  // Scrollbar
  const scrollThumb = isLight
    ? withOpacity(text, 0.2)
    : withOpacity(text, 0.25);
  const scrollThumbHover = isLight
    ? withOpacity(text, 0.3)
    : withOpacity(text, 0.35);

  vars.push(`--color-scrollbar-track: transparent;`);
  vars.push(`--color-scrollbar-thumb: ${scrollThumb};`);
  vars.push(`--color-scrollbar-thumb-hover: ${scrollThumbHover};`);

  return vars;
}

/**
 * Generate CSS variables string from a theme object
 */
export function generateThemeCSS(theme: OurinTheme): string {
  const { background, text, accent } = theme.colors;
  return deriveAllColors(background, text, accent, theme.type).join("\n  ");
}

/**
 * Generate a complete CSS :root block
 */
export function generateThemeCSSBlock(theme: OurinTheme): string {
  const cssVars = generateThemeCSS(theme);
  return `:root {\n  ${cssVars}\n}`;
}

/**
 * Generate inline style object for React
 */
export function generateThemeStyleObject(
  theme: OurinTheme
): Record<string, string> {
  const { background, text, accent } = theme.colors;
  const vars = deriveAllColors(background, text, accent, theme.type);

  const style: Record<string, string> = {};
  for (const v of vars) {
    const [key, value] = v.replace(";", "").split(": ");
    style[key] = value;
  }

  return style;
}

/**
 * Create a style tag content for SSR theme injection
 */
export function createThemeStyleTag(theme: OurinTheme): string {
  return `<style id="ourin-theme">${generateThemeCSSBlock(theme)}</style>`;
}
