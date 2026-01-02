/**
 * font cSS variable mapping for the application.
 * maps font iDs to their cSS variable or fallback stack.
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
 * get the cSS font-family value for a given font iD.
 * falls back to lato if the font iD is not found.
 */
export function getFontFamily(fontId: string): string {
  return FONT_CSS_MAP[fontId] || FONT_CSS_MAP.lato;
}
