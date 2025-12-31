"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import {
  OurinTheme,
  getThemeById,
  defaultTheme,
  builtInThemes,
  generateThemeCSSBlock,
  AVAILABLE_FONTS,
  FontOption,
} from "@ourin/core";
import { recordThemeUsage } from "@/components/command-palette/themeUsageTracker";
import { getFontFamily } from "@/lib/fonts";
import { setCookie, deleteCookie, getCookie } from "@/lib/cookies";

interface ThemeContextValue {
  // Theme
  theme: OurinTheme;
  themeId: string;
  setTheme: (themeId: string) => void;
  setCustomTheme: (theme: OurinTheme) => void;
  builtInThemes: OurinTheme[];
  customThemes: OurinTheme[];
  addCustomTheme: (theme: OurinTheme, autoSelect?: boolean) => void;
  removeCustomTheme: (themeId: string) => void;

  // Font
  fontId: string;
  setFont: (fontId: string) => void;
  availableFonts: FontOption[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  initialThemeId?: string;
  initialFontId?: string;
}

export function ThemeProvider({
  children,
  initialThemeId = defaultTheme.id,
  initialFontId = "lato",
}: ThemeProviderProps) {
  const [themeId, setThemeId] = useState(initialThemeId);
  const [fontId, setFontId] = useState(initialFontId);
  const [customThemes, setCustomThemes] = useState<OurinTheme[]>([]);
  const [customTheme, setCustomThemeState] = useState<OurinTheme | null>(null);

  // On mount, sync theme state with system preference for first-time visitors
  // The cookie was already set by the inline script, so we read it to sync state
  useEffect(() => {
    const cookieTheme = getCookie("ourin-theme");

    if (cookieTheme && cookieTheme !== themeId) {
      setThemeId(cookieTheme);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get current theme
  const theme =
    customTheme ||
    getThemeById(themeId) ||
    customThemes.find((t) => t.id === themeId) ||
    defaultTheme;

  // Generate favicon SVG with theme colors (lotus icon)
  const generateFaviconSvg = useCallback(
    (colors: { text: string; background: string; accent: string }) => {
      return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="32" height="32" fill="${colors.background}"/>
<g transform="scale(1.6) translate(3.75, 3.75)">
<path d="M11.4752 17.1587C11.0981 18.0697 10.898 19.0269 10.704 20C10.5148 19.8822 10.5757 19.6992 10.5751 19.5558C10.5648 17.2152 10.5816 14.8739 10.5471 12.5339C10.5154 10.3839 10.5122 8.23396 10.4925 6.08407C10.4887 5.66132 10.5817 5.32858 10.7943 5.00668C12.1398 2.96949 13.7513 1.35466 15.6041 0.118914C15.9294 -0.0980727 16.0121 -0.0322272 16.0133 0.433787C16.0178 2.10155 16.0128 3.76939 16.0228 5.43708C16.0293 6.50438 16.079 7.57183 16.0687 8.63858C16.0485 10.7174 15.4125 12.4071 14.026 13.5942C12.9534 14.5125 12.0901 15.6718 11.4752 17.1587Z" fill="${colors.accent}"/>
<path d="M5.73559 13.3787C4.50961 12.0531 3.99433 10.3924 4.01295 8.39102C4.03663 5.84567 3.98787 3.29925 3.97327 0.753263C3.97204 0.538695 3.94856 0.315358 4.03064 0.116212C4.22603 0.03296 4.35847 0.180904 4.49438 0.271732C6.34679 1.50973 7.9536 3.13644 9.31715 5.1497C9.45713 5.35637 9.49422 5.57541 9.49592 5.83396C9.51679 8.99466 9.52446 12.1558 9.57497 15.3157C9.59695 16.6909 9.61712 18.0657 9.61651 19.441C9.61645 19.5916 9.66082 19.7632 9.54996 19.8918C9.42378 19.8922 9.43494 19.7577 9.41994 19.6734C8.95627 17.0691 7.81753 15.074 6.03614 13.6552C5.93847 13.5774 5.84828 13.4846 5.73559 13.3787Z" fill="${colors.accent}"/>
<path d="M2.14033 3.86584C2.54428 4.21159 2.9247 4.54417 3.30832 4.87073C3.53914 5.06722 3.58279 5.35829 3.58287 5.67785C3.58313 6.64377 3.59343 7.60983 3.58392 8.57559C3.55918 11.0863 4.40985 12.9883 6.06007 14.3501C6.59532 14.7918 7.0746 15.3207 7.48918 15.9383C7.56719 16.0545 7.67977 16.1563 7.65726 16.3671C7.48931 16.396 7.37974 16.2453 7.25783 16.1578C6.56702 15.6619 5.83309 15.3449 5.04847 15.1646C2.13497 14.4953 0.0614889 11.3242 0.0140747 7.8052C-0.00702116 6.23964 0.00212454 4.67339 0.00117729 3.10744C0.00087531 2.60938 0.0697626 2.55062 0.423497 2.74439C1.00788 3.06451 1.57315 3.43281 2.14033 3.86584Z" fill="${colors.accent}"/>
<path d="M16.4838 7.23397C16.4795 6.63587 16.483 6.07978 16.4694 5.52435C16.4617 5.20824 16.5342 4.96479 16.7351 4.76078C17.6145 3.86788 18.572 3.1383 19.5914 2.53396C19.8413 2.38583 19.9872 2.41931 19.9763 2.82917C19.9294 4.5974 20.0446 6.36508 19.9793 8.13437C19.8678 11.1549 17.9044 14.1871 15.5608 14.8813C14.53 15.1866 13.5221 15.5378 12.6485 16.3349C12.6026 16.3768 12.551 16.4164 12.4402 16.3381C12.6469 15.8691 12.9429 15.4979 13.2333 15.1191C13.7598 14.4324 14.4481 14.0022 14.9844 13.3284C15.9119 12.1629 16.4225 10.7709 16.4803 9.11475C16.5017 8.50168 16.5442 7.88934 16.4838 7.23397Z" fill="${colors.accent}"/>
</g>
</svg>`;
    },
    []
  );

  // Update favicon with theme colors
  const updateFavicon = useCallback(
    (colors: { text: string; background: string; accent: string }) => {
      const svg = generateFaviconSvg(colors);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      // Remove any existing dynamic favicons
      const existingIcons = document.querySelectorAll(
        "link[rel='icon'][data-dynamic='true']"
      );
      existingIcons.forEach((icon) => {
        const href = (icon as HTMLLinkElement).href;
        if (href.startsWith("blob:")) {
          URL.revokeObjectURL(href);
        }
        icon.remove();
      });

      // Create fresh favicon link
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      link.href = url;
      link.setAttribute("data-dynamic", "true");
      document.head.appendChild(link);
    },
    [generateFaviconSvg]
  );

  // Update theme CSS in DOM
  const updateThemeCSS = useCallback(
    (newTheme: OurinTheme) => {
      const styleEl = document.getElementById("ourin-theme");
      if (styleEl) {
        styleEl.innerHTML = generateThemeCSSBlock(newTheme);
      }
      updateFavicon({
        text: newTheme.colors.text,
        background: newTheme.colors.background,
        accent: newTheme.colors.accent,
      });
    },
    [updateFavicon]
  );

  // Update font CSS in DOM
  const updateFontCSS = useCallback((newFontId: string) => {
    const fontFamily = getFontFamily(newFontId);
    const styleEl = document.getElementById("ourin-font");
    if (styleEl) {
      styleEl.innerHTML = `:root { --font-family: ${fontFamily}; }`;
    }
  }, []);

  // Set theme by ID
  const setTheme = useCallback(
    (newThemeId: string) => {
      const newTheme =
        getThemeById(newThemeId) ||
        customThemes.find((t) => t.id === newThemeId);
      if (newTheme) {
        setThemeId(newThemeId);
        setCustomThemeState(null);
        updateThemeCSS(newTheme);
        recordThemeUsage(newThemeId);
        // Save to cookie
        setCookie("ourin-theme", newThemeId);
        // For custom themes, also save colors to cookie for SSR
        if (newThemeId.startsWith("custom-")) {
          const colorsJson = JSON.stringify({
            type: newTheme.type,
            colors: newTheme.colors,
          });
          setCookie("ourin-custom-theme-data", encodeURIComponent(colorsJson));
        } else {
          // Clear custom theme data cookie for built-in themes
          deleteCookie("ourin-custom-theme-data");
        }
      }
    },
    [customThemes, updateThemeCSS]
  );

  // Set custom theme (for live preview)
  const setCustomTheme = useCallback(
    (newTheme: OurinTheme) => {
      setCustomThemeState(newTheme);
      updateThemeCSS(newTheme);
    },
    [updateThemeCSS]
  );

  // Set UI font
  const setFont = useCallback(
    (newFontId: string) => {
      setFontId(newFontId);
      updateFontCSS(newFontId);
      // Save to cookie
      setCookie("ourin-font", newFontId);
    },
    [updateFontCSS]
  );

  // Add custom theme (also applies CSS if it's the current theme)
  // If autoSelect is true, immediately selects the new theme (avoids stale closure issues)
  const addCustomTheme = useCallback(
    (newTheme: OurinTheme, autoSelect?: boolean) => {
      setCustomThemes((prev) => {
        const filtered = prev.filter((t) => t.id !== newTheme.id);
        const updated = [...filtered, newTheme];
        // Save to localStorage
        localStorage.setItem("ourin-custom-themes", JSON.stringify(updated));
        return updated;
      });

      // Auto-select the new theme immediately (used when creating new themes)
      if (autoSelect) {
        setThemeId(newTheme.id);
        setCustomThemeState(null);
        updateThemeCSS(newTheme);
        recordThemeUsage(newTheme.id);
        // Save to cookie
        setCookie("ourin-theme", newTheme.id);
        // Save custom theme colors to cookie for SSR
        const colorsJson = JSON.stringify({
          type: newTheme.type,
          colors: newTheme.colors,
        });
        setCookie("ourin-custom-theme-data", encodeURIComponent(colorsJson));
      }
      // If this is already the current theme (editing), apply CSS changes
      else if (newTheme.id === themeId) {
        updateThemeCSS(newTheme);
        // Update custom theme data cookie for SSR
        const colorsJson = JSON.stringify({
          type: newTheme.type,
          colors: newTheme.colors,
        });
        setCookie("ourin-custom-theme-data", encodeURIComponent(colorsJson));
      }
    },
    [themeId, updateThemeCSS]
  );

  // Remove custom theme
  const removeCustomTheme = useCallback(
    (removeThemeId: string) => {
      setCustomThemes((prev) => {
        const updated = prev.filter((t) => t.id !== removeThemeId);
        localStorage.setItem("ourin-custom-themes", JSON.stringify(updated));
        return updated;
      });
      // If current theme was removed, switch to default and clear cookie
      if (themeId === removeThemeId) {
        deleteCookie("ourin-custom-theme-data");
        setTheme(defaultTheme.id);
      }
    },
    [themeId, setTheme]
  );

  // Update favicon on mount and when theme changes
  useEffect(() => {
    updateFavicon({
      text: theme.colors.text,
      background: theme.colors.background,
      accent: theme.colors.accent,
    });
  }, [
    theme.colors.text,
    theme.colors.background,
    theme.colors.accent,
    updateFavicon,
  ]);

  // Load custom themes from localStorage on mount
  // Includes migration from old nested format to new 3-color format
  useEffect(() => {
    const stored = localStorage.getItem("ourin-custom-themes");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Migrate old format themes to new 3-color format
          const migrated = parsed.map(
            (t: OurinTheme | Record<string, unknown>) => {
              // Check if it's old format (colors.background is an object)
              if (
                t.colors &&
                typeof (t.colors as Record<string, unknown>).background ===
                  "object"
              ) {
                const oldColors = t.colors as Record<
                  string,
                  Record<string, string>
                >;
                return {
                  ...t,
                  colors: {
                    background: oldColors.background?.primary || "#ffffff",
                    text: oldColors.text?.primary || "#000000",
                    accent: oldColors.accent?.primary || "#3b82f6",
                  },
                };
              }
              return t;
            }
          );
          setCustomThemes(migrated as OurinTheme[]);
          // Save migrated themes back
          localStorage.setItem("ourin-custom-themes", JSON.stringify(migrated));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeId,
        setTheme,
        setCustomTheme,
        builtInThemes,
        customThemes,
        addCustomTheme,
        removeCustomTheme,
        fontId,
        setFont,
        availableFonts: AVAILABLE_FONTS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
