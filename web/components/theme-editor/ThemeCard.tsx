"use client";

import { memo, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import type { OurinTheme } from "@ourin/core";

interface ThemeCardProps {
  theme: OurinTheme;
  isActive: boolean;
  isCustom?: boolean;
  onSelect: (themeId: string) => void;
  onHoverStart?: (themeId: string) => void;
  onHoverEnd?: () => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
}

/**
 * A card displaying a theme preview with color swatches.
 * Memoized to prevent unnecessary re-renders.
 */
export const ThemeCard = memo(function ThemeCard({
  theme: t,
  isActive,
  isCustom = false,
  onSelect,
  onHoverStart,
  onHoverEnd,
  cardRef,
}: ThemeCardProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLButtonElement).blur();
      onSelect(t.id);
    },
    [onSelect, t.id]
  );

  const handleMouseEnter = useCallback(() => {
    if (isCustom && isActive && onHoverStart) {
      onHoverStart(t.id);
    }
  }, [isCustom, isActive, onHoverStart, t.id]);

  const handleMouseLeave = useCallback(() => {
    if (isCustom && onHoverEnd) {
      onHoverEnd();
    }
  }, [isCustom, onHoverEnd]);

  return (
    <button
      type="button"
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative p-2 rounded-sm text-left transition-all"
      style={{
        border: `2px solid ${
          isActive
            ? "var(--color-accent-primary)"
            : "var(--color-border-default)"
        }`,
        backgroundColor: isActive
          ? "var(--color-accent-primary-muted)"
          : "transparent",
      }}
    >
      {/* Preview swatch */}
      <div
        className="mb-2 rounded h-10"
        style={{
          backgroundColor: t.colors.background,
          border: "1px solid rgba(0,0,0,0.1)",
        }}
      >
        <div className="flex gap-1 p-1.5">
          <div
            className="rounded-full w-6 h-1.5"
            style={{ backgroundColor: t.colors.accent }}
          />
          <div
            className="opacity-50 rounded-full w-8 h-1.5"
            style={{ backgroundColor: t.colors.text }}
          />
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          {t.type === "dark" ? (
            <Moon className="w-3 h-3" />
          ) : (
            <Sun className="w-3 h-3 text-amber-500" />
          )}
          <span
            className="font-medium text-xs"
            style={{ color: "var(--color-text-primary)" }}
          >
            {t.name}
          </span>
        </div>
      </div>
    </button>
  );
});
