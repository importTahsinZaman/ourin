/**
 * Font CSS variable mapping for the application.
 * Maps font IDs to their CSS variable or fallback stack.
 */
export const FONT_CSS_MAP: Record<string, string> = {
  inter: "var(--font-inter)",
  geist: "var(--font-geist)",
  "ibm-plex": "var(--font-ibm-plex)",
  "source-sans": "var(--font-source-sans)",
  nunito: "var(--font-nunito)",
  lato: "var(--font-lato)",
  "open-sans": "var(--font-open-sans)",
  roboto: "var(--font-roboto)",
  "plus-jakarta": "var(--font-plus-jakarta)",
  system:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

/**
 * Get the CSS font-family value for a given font ID.
 * Falls back to Lato if the font ID is not found.
 */
export function getFontFamily(fontId: string): string {
  return FONT_CSS_MAP[fontId] || FONT_CSS_MAP.lato;
}
