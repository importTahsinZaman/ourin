"use client";

import { useCallback, useRef, useState, useMemo, useEffect } from "react";
import { X, Palette, Trash2 } from "lucide-react";
import { cn, isLightColor } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import { OurinTheme } from "@ourin/core";
import { ThemeCard } from "./ThemeCard";
import { ColorInput } from "./ColorInput";

interface ThemeEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  side?: "left" | "right";
  onFlipSidebar?: () => void;
}

export function ThemeEditorPanel({
  isOpen,
  onClose,
  side = "right",
  onFlipSidebar,
}: ThemeEditorPanelProps) {
  const {
    theme,
    themeId,
    setTheme,
    builtInThemes,
    customThemes,
    addCustomTheme,
    removeCustomTheme,
    fontId,
    setFont,
    availableFonts,
  } = useTheme();

  const currentCustomTheme = customThemes.find((t) => t.id === themeId);
  const [editorPosition, setEditorPosition] = useState<{
    top: number;
    left: number;
    right: number;
  } | null>(null);
  const [isHoveringSelected, setIsHoveringSelected] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [localThemeName, setLocalThemeName] = useState(
    currentCustomTheme?.name ?? ""
  );
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editor should be visible if hovering OR color picker is open
  const showEditor = isHoveringSelected || isColorPickerOpen;

  // Sync local theme name when the custom theme changes
  useEffect(() => {
    setLocalThemeName(currentCustomTheme?.name ?? "");
  }, [currentCustomTheme?.name]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (nameDebounceRef.current) {
        clearTimeout(nameDebounceRef.current);
      }
    };
  }, []);

  // Update editor position when hovering selected custom theme
  const updateEditorPosition = useCallback((themeId: string) => {
    const cardEl = cardRefs.current.get(themeId);
    if (cardEl) {
      const cardRect = cardEl.getBoundingClientRect();
      setEditorPosition({
        top: cardRect.top,
        left: cardRect.left,
        right: cardRect.right,
      });
    }
  }, []);

  // Generate the next available "Theme n" name
  const getNextThemeName = useCallback(() => {
    const existingNumbers = customThemes
      .map((t) => {
        const match = t.name.match(/^Theme (\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null);

    let n = 1;
    while (existingNumbers.includes(n)) {
      n++;
    }
    return `Theme ${n}`;
  }, [customThemes]);

  // Create a new theme based on the current theme (auto-detect light/dark)
  const handleCreateNew = useCallback(() => {
    const newTheme: OurinTheme = {
      id: `custom-${Date.now()}`,
      name: getNextThemeName(),
      type: isLightColor(theme.colors.background) ? "light" : "dark",
      colors: {
        background: theme.colors.background,
        text: theme.colors.text,
        accent: theme.colors.accent,
      },
    };

    // Add and auto-select the new theme (avoids stale closure issues with setTheme)
    addCustomTheme(newTheme, true);
  }, [theme, getNextThemeName, addCustomTheme]);

  // Update custom theme property (auto-saves, auto-detects light/dark)
  const updateCustomTheme = useCallback(
    (updates: Partial<OurinTheme>) => {
      if (!currentCustomTheme) return;

      const newColors = {
        ...currentCustomTheme.colors,
        ...(updates.colors || {}),
      };

      // Auto-detect type if background color changed
      const newType = updates.colors?.background
        ? isLightColor(updates.colors.background)
          ? "light"
          : "dark"
        : currentCustomTheme.type;

      const updated: OurinTheme = {
        ...currentCustomTheme,
        ...updates,
        type: newType,
        colors: newColors,
      };

      addCustomTheme(updated);
    },
    [currentCustomTheme, addCustomTheme]
  );

  // Debounced theme name change handler
  const handleThemeNameChange = useCallback(
    (newName: string) => {
      setLocalThemeName(newName);

      if (nameDebounceRef.current) {
        clearTimeout(nameDebounceRef.current);
      }

      nameDebounceRef.current = setTimeout(() => {
        updateCustomTheme({ name: newName });
      }, 300);
    },
    [updateCustomTheme]
  );

  // Memoize filtered theme lists
  const lightThemes = useMemo(
    () => builtInThemes.filter((t) => t.type === "light"),
    [builtInThemes]
  );
  const darkThemes = useMemo(
    () => builtInThemes.filter((t) => t.type === "dark"),
    [builtInThemes]
  );

  // Callbacks for ThemeCard
  const handleThemeSelect = useCallback(
    (id: string) => setTheme(id),
    [setTheme]
  );

  const handleHoverStart = useCallback(
    (id: string) => {
      updateEditorPosition(id);
      setIsHoveringSelected(true);
    },
    [updateEditorPosition]
  );

  const handleHoverEnd = useCallback(() => {
    setIsHoveringSelected(false);
  }, []);

  // Ref callback for custom theme cards
  const getCardRef = useCallback(
    (themeId: string) => (el: HTMLButtonElement | null) => {
      if (el) {
        cardRefs.current.set(themeId, el);
      } else {
        cardRefs.current.delete(themeId);
      }
    },
    []
  );

  return (
    <div
      className={cn(
        "relative h-full transition-all duration-300 ease-out",
        isOpen ? "w-[320px]" : "w-0"
      )}
      ref={panelRef}
    >
      {/* Floating editor - appears on the opposite side when hovering selected custom theme */}
      {currentCustomTheme &&
        editorPosition !== null &&
        isOpen &&
        showEditor && (
          <div
            className="slide-in-from-right-2 z-50 fixed shadow-lg rounded-sm w-56 animate-in duration-150 fade-in"
            style={{
              top: editorPosition.top,
              ...(side === "right"
                ? { right: `calc(100vw - ${editorPosition.left}px + 8px)` }
                : { left: editorPosition.right + 8 }),
              backgroundColor: "var(--color-background-elevated)",
              border: "1px solid var(--color-border-default)",
            }}
            onMouseEnter={() => setIsHoveringSelected(true)}
            onMouseLeave={() => setIsHoveringSelected(false)}
          >
            {/* Invisible bridge to connect editor to card */}
            <div
              className={cn(
                "top-0 absolute h-full",
                side === "right" ? "left-full w-4" : "right-full w-4"
              )}
              onMouseEnter={() => setIsHoveringSelected(true)}
            />
            <div className="space-y-3 p-3">
              {/* Header */}
              <div className="flex justify-between items-center">
                <span
                  className="font-medium text-xs"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Edit Theme
                </span>
                <button
                  onClick={() => removeCustomTheme(currentCustomTheme.id)}
                  className="hover:bg-red-500/10 p-1 rounded text-red-500 transition-colors"
                  title="Delete theme"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Theme name */}
              <input
                value={localThemeName}
                onChange={(e) => handleThemeNameChange(e.target.value)}
                className="px-2.5 py-1.5 rounded focus:outline-none w-full text-sm"
                style={{
                  backgroundColor: "var(--color-background-input)",
                  border: "1px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                }}
                placeholder="Theme name"
              />

              {/* Colors */}
              <div className="space-y-2">
                <ColorInput
                  label="Background"
                  value={currentCustomTheme.colors.background}
                  onChange={(value) =>
                    updateCustomTheme({
                      colors: {
                        ...currentCustomTheme.colors,
                        background: value,
                      },
                    })
                  }
                  onPickerOpen={() => setIsColorPickerOpen(true)}
                  onPickerClose={() => setIsColorPickerOpen(false)}
                />
                <ColorInput
                  label="Text"
                  value={currentCustomTheme.colors.text}
                  onChange={(value) =>
                    updateCustomTheme({
                      colors: { ...currentCustomTheme.colors, text: value },
                    })
                  }
                  onPickerOpen={() => setIsColorPickerOpen(true)}
                  onPickerClose={() => setIsColorPickerOpen(false)}
                />
                <ColorInput
                  label="Accent"
                  value={currentCustomTheme.colors.accent}
                  onChange={(value) =>
                    updateCustomTheme({
                      colors: { ...currentCustomTheme.colors, accent: value },
                    })
                  }
                  onPickerOpen={() => setIsColorPickerOpen(true)}
                  onPickerClose={() => setIsColorPickerOpen(false)}
                />
              </div>
            </div>
          </div>
        )}

      {/* Main panel */}
      <aside
        className={cn(
          "relative h-full overflow-hidden",
          isOpen && (side === "right" ? "border-l" : "border-r"),
          "transition-all duration-300 ease-out",
          isOpen ? "w-[320px]" : "w-0"
        )}
        style={{
          backgroundColor: "var(--color-background-secondary)",
          borderColor: "var(--color-border-default)",
        }}
      >
        <div className="flex flex-col w-[320px] h-full">
          {/* Header */}
          <div
            className="flex flex-shrink-0 justify-between items-center px-4 py-3"
            style={{ borderBottom: "1px solid var(--color-border-muted)" }}
          >
            <h2
              className="font-semibold text-sm"
              style={{ color: "var(--color-text-primary)" }}
            >
              Appearance
            </h2>
            <button
              onClick={onClose}
              className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-6">
              {/* Built-in themes */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3
                    className="font-medium text-sm"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Themes
                  </h3>
                </div>
                <div className="gap-2 grid grid-cols-2 max-h-[360px] overflow-y-auto">
                  {/* Light themes column */}
                  <div className="flex flex-col gap-2 pb-1">
                    {lightThemes.map((t) => (
                      <ThemeCard
                        key={t.id}
                        theme={t}
                        isActive={themeId === t.id}
                        onSelect={handleThemeSelect}
                      />
                    ))}
                  </div>
                  {/* Dark themes column */}
                  <div className="flex flex-col gap-2 pb-1">
                    {darkThemes.map((t) => (
                      <ThemeCard
                        key={t.id}
                        theme={t}
                        isActive={themeId === t.id}
                        onSelect={handleThemeSelect}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom themes */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3
                    className="font-medium text-sm"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Custom
                  </h3>
                  <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-1.5 hover:opacity-80 px-2 py-1 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: "var(--color-accent-primary)",
                      color: "var(--color-text-inverse)",
                    }}
                  >
                    <Palette className="w-3 h-3" />
                    New
                  </button>
                </div>

                {customThemes.length === 0 ? (
                  <div
                    className="py-6 rounded-sm text-center"
                    style={{
                      backgroundColor: "var(--color-background-tertiary)",
                      border: "1px dashed var(--color-border-default)",
                    }}
                  >
                    <Palette
                      className="mx-auto mb-2 w-6 h-6"
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      No custom themes yet
                    </p>
                  </div>
                ) : (
                  <div className="gap-2 grid grid-cols-2 max-h-[360px] overflow-y-auto">
                    {customThemes.map((t) => (
                      <ThemeCard
                        key={t.id}
                        theme={t}
                        isActive={themeId === t.id}
                        isCustom
                        onSelect={handleThemeSelect}
                        onHoverStart={handleHoverStart}
                        onHoverEnd={handleHoverEnd}
                        cardRef={getCardRef(t.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* UI Font selector */}
              <div>
                <h3
                  className="mb-3 font-medium text-sm"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  UI Font
                </h3>
                <div className="space-y-1">
                  {availableFonts.map((font) => {
                    const isActive = fontId === font.id;
                    return (
                      <button
                        key={font.id}
                        onClick={() => setFont(font.id)}
                        className="flex justify-between items-center px-3 py-2 rounded-sm w-full text-left transition-all"
                        style={{
                          border: `1px solid ${
                            isActive
                              ? "var(--color-accent-primary)"
                              : "var(--color-border-default)"
                          }`,
                          backgroundColor: isActive
                            ? "var(--color-accent-primary-muted)"
                            : "transparent",
                        }}
                      >
                        <span
                          className="text-sm"
                          style={{
                            fontFamily: `${font.cssVar}, sans-serif`,
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {font.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Layout */}
              <div>
                <h3
                  className="mb-3 font-medium text-sm"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Layout
                </h3>
                <button
                  onClick={onFlipSidebar}
                  className="flex justify-between items-center px-3 py-2 rounded-sm w-full text-left transition-all"
                  style={{
                    border: "1px solid var(--color-border-default)",
                    backgroundColor: "transparent",
                  }}
                >
                  <span
                    className="text-sm"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Flip sidebar side
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {side === "right" ? "Left" : "Right"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
