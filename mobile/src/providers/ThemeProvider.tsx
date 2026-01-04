import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useColorScheme } from "react-native";
import {
  builtInThemes,
  getThemeById,
  defaultTheme,
  type OurinTheme,
  AVAILABLE_FONTS,
  type FontOption,
} from "@ourin/core";
import { storage, STORAGE_KEYS } from "@/lib/storage";

interface ThemeContextValue {
  // Current theme
  theme: OurinTheme;
  themeId: string;
  setTheme: (id: string) => void;

  // Custom themes
  customThemes: OurinTheme[];
  addCustomTheme: (theme: OurinTheme) => void;
  updateCustomTheme: (theme: OurinTheme) => void;
  removeCustomTheme: (id: string) => void;

  // Font
  fontId: string;
  setFont: (id: string) => void;
  currentFont: FontOption;

  // Theme lists
  builtInThemes: OurinTheme[];
  lightThemes: OurinTheme[];
  darkThemes: OurinTheme[];
  allThemes: OurinTheme[];
  availableFonts: FontOption[];

  // Loading state
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_THEME_ID = "ourin-dark";
const DEFAULT_FONT_ID = "system";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [customThemes, setCustomThemes] = useState<OurinTheme[]>([]);
  const [fontId, setFontId] = useState<string>(DEFAULT_FONT_ID);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const [savedThemeId, savedCustomThemes, savedFontId] =
          await Promise.all([
            storage.getString(STORAGE_KEYS.THEME_ID),
            storage.getJSON<OurinTheme[]>(STORAGE_KEYS.CUSTOM_THEMES),
            storage.getString(STORAGE_KEYS.FONT_ID),
          ]);

        if (savedThemeId) {
          setThemeId(savedThemeId);
        } else if (systemColorScheme) {
          // Default to system preference
          setThemeId(
            systemColorScheme === "dark" ? "ourin-dark" : "ourin-light"
          );
        }

        if (savedCustomThemes && Array.isArray(savedCustomThemes)) {
          setCustomThemes(savedCustomThemes);
        }

        if (savedFontId) {
          setFontId(savedFontId);
        }
      } catch (error) {
        console.warn("[ThemeProvider] Failed to load preferences:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [systemColorScheme]);

  // Set theme and persist
  const handleSetTheme = useCallback((id: string) => {
    setThemeId(id);
    storage.setString(STORAGE_KEYS.THEME_ID, id);
  }, []);

  // Add custom theme
  const addCustomTheme = useCallback((theme: OurinTheme) => {
    setCustomThemes((prev) => {
      const updated = [...prev, theme];
      storage.setJSON(STORAGE_KEYS.CUSTOM_THEMES, updated);
      return updated;
    });
  }, []);

  // Update custom theme
  const updateCustomTheme = useCallback((theme: OurinTheme) => {
    setCustomThemes((prev) => {
      const updated = prev.map((t) => (t.id === theme.id ? theme : t));
      storage.setJSON(STORAGE_KEYS.CUSTOM_THEMES, updated);
      return updated;
    });
  }, []);

  // Remove custom theme
  const removeCustomTheme = useCallback(
    (id: string) => {
      setCustomThemes((prev) => {
        const updated = prev.filter((t) => t.id !== id);
        storage.setJSON(STORAGE_KEYS.CUSTOM_THEMES, updated);
        return updated;
      });
      // If removed theme was active, switch to default
      if (themeId === id) {
        handleSetTheme(DEFAULT_THEME_ID);
      }
    },
    [themeId, handleSetTheme]
  );

  // Set font and persist
  const handleSetFont = useCallback((id: string) => {
    setFontId(id);
    storage.setString(STORAGE_KEYS.FONT_ID, id);
  }, []);

  // Memoized theme lists
  const lightThemes = useMemo(
    () => builtInThemes.filter((t) => t.type === "light"),
    []
  );

  const darkThemes = useMemo(
    () => builtInThemes.filter((t) => t.type === "dark"),
    []
  );

  const allThemes = useMemo(
    () => [...builtInThemes, ...customThemes],
    [customThemes]
  );

  // Current theme object
  const theme = useMemo(() => {
    // Check built-in themes first
    const builtIn = getThemeById(themeId);
    if (builtIn) return builtIn;

    // Check custom themes
    const custom = customThemes.find((t) => t.id === themeId);
    if (custom) return custom;

    // Fallback to default
    return defaultTheme;
  }, [themeId, customThemes]);

  // Current font object
  const currentFont = useMemo(() => {
    return (
      AVAILABLE_FONTS.find((f) => f.id === fontId) ||
      AVAILABLE_FONTS.find((f) => f.id === "system")!
    );
  }, [fontId]);

  const value: ThemeContextValue = {
    theme,
    themeId,
    setTheme: handleSetTheme,
    customThemes,
    addCustomTheme,
    updateCustomTheme,
    removeCustomTheme,
    fontId,
    setFont: handleSetFont,
    currentFont,
    builtInThemes,
    lightThemes,
    darkThemes,
    allThemes,
    availableFonts: AVAILABLE_FONTS,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
