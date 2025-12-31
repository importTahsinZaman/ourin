"use client";

import { memo } from "react";

interface ThemeColorSwatchProps {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

export const ThemeColorSwatch = memo(function ThemeColorSwatch({
  backgroundColor,
  textColor,
  accentColor,
}: ThemeColorSwatchProps) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{
          backgroundColor: accentColor,
          border: "1px solid rgba(128, 128, 128, 0.25)",
        }}
      />
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{
          backgroundColor: textColor,
          border: "1px solid rgba(128, 128, 128, 0.25)",
        }}
      />
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{
          backgroundColor,
          border: "1px solid rgba(128, 128, 128, 0.25)",
        }}
      />
    </div>
  );
});
