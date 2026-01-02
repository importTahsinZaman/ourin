/**
 * 3-color theme system
 * all other colors are derived from these three base colors
 */

export interface OurinTheme {
  id: string;
  name: string;
  author?: string;
  description?: string;
  version?: string;
  type: "light" | "dark";
  colors: {
    background: string; // base background color
    text: string; // base text color
    accent: string; // primary accent color (buttons, links, focus)
  };
}

export interface FontOption {
  id: string;
  name: string;
  cssVar: string;
}

export const AVAILABLE_FONTS: FontOption[] = [
  { id: "lato", name: "Lato", cssVar: "var(--font-lato)" },
  { id: "inter", name: "Inter", cssVar: "var(--font-inter)" },
  { id: "geist", name: "Geist", cssVar: "var(--font-geist)" },
  { id: "ibm-plex", name: "IBM Plex Sans", cssVar: "var(--font-ibm-plex)" },
  { id: "source-sans", name: "Source Sans", cssVar: "var(--font-source-sans)" },
  { id: "nunito", name: "Nunito", cssVar: "var(--font-nunito)" },
  { id: "open-sans", name: "Open Sans", cssVar: "var(--font-open-sans)" },
  { id: "roboto", name: "Roboto", cssVar: "var(--font-roboto)" },
  {
    id: "plus-jakarta",
    name: "Plus Jakarta Sans",
    cssVar: "var(--font-plus-jakarta)",
  },
  {
    id: "system",
    name: "System",
    cssVar:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
];
