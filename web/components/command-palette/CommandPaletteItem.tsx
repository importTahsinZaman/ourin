"use client";

import { useRef, useEffect, memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteItemProps {
  icon?: LucideIcon;
  customIcon?: React.ReactNode;
  label: string;
  matchedIndices: number[];
  shortcut?: string;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

/**
 * renders text with matched characters highlighted
 * optimized to group consecutive characters into segments to reduce dOM nodes
 */
function HighlightedText({
  text,
  matchedIndices,
}: {
  text: string;
  matchedIndices: number[];
}) {
  if (matchedIndices.length === 0) {
    return <span>{text}</span>;
  }

  const matchSet = new Set(matchedIndices);
  const segments: { text: string; highlighted: boolean }[] = [];

  let currentSegment = "";
  let currentHighlighted = matchSet.has(0);

  for (let i = 0; i < text.length; i++) {
    const isHighlighted = matchSet.has(i);
    if (isHighlighted === currentHighlighted) {
      currentSegment += text[i];
    } else {
      if (currentSegment) {
        segments.push({
          text: currentSegment,
          highlighted: currentHighlighted,
        });
      }
      currentSegment = text[i];
      currentHighlighted = isHighlighted;
    }
  }
  if (currentSegment) {
    segments.push({ text: currentSegment, highlighted: currentHighlighted });
  }

  return (
    <>
      {segments.map((segment, i) => (
        <span
          key={i}
          style={{
            fontWeight: segment.highlighted ? 600 : 400,
            color: segment.highlighted
              ? "var(--color-accent-primary)"
              : undefined,
          }}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}

export const CommandPaletteItem = memo(function CommandPaletteItem({
  icon: Icon,
  customIcon,
  label,
  matchedIndices,
  shortcut,
  isSelected,
  onClick,
  onMouseEnter,
}: CommandPaletteItemProps) {
  const itemRef = useRef<HTMLButtonElement>(null);

  // scroll into view when selected
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

  return (
    <button
      ref={itemRef}
      className={cn(
        "flex items-center gap-3 mx-1 px-3 py-2 rounded-sm w-full text-left transition-colors duration-75",
        isSelected && "bg-[var(--color-background-hover)]"
      )}
      style={{
        width: "calc(100% - 8px)",
      }}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {customIcon ? (
        customIcon
      ) : Icon ? (
        <Icon
          className="w-4 h-4 shrink-0"
          style={{ color: "var(--color-text-muted)" }}
        />
      ) : null}
      <span
        className="flex-1 text-sm truncate"
        style={{ color: "var(--color-text-primary)" }}
      >
        <HighlightedText text={label} matchedIndices={matchedIndices} />
      </span>
      {shortcut && (
        <kbd
          className="font-mono text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
});
