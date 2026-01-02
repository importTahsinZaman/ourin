"use client";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { isValidHexColor } from "@/lib/utils";

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPickerOpen?: () => void;
  onPickerClose?: () => void;
  debounceMs?: number;
}

/**
 * a color input with both a color picker and a text input for hex values.
 * includes debouncing for text input changes and hex validation.
 */
export const ColorInput = memo(function ColorInput({
  label,
  value,
  onChange,
  onPickerOpen,
  onPickerClose,
  debounceMs = 300,
}: ColorInputProps) {
  // local state for the text input to allow typing without immediate validation
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // sync local value when prop changes (e.g., from color picker)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleTextChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);

      // clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // debounce the validation and update
      debounceRef.current = setTimeout(() => {
        // only update if valid hex
        if (isValidHexColor(newValue)) {
          // ensure it has # prefix
          const normalized = newValue.startsWith("#")
            ? newValue
            : `#${newValue}`;
          onChange(normalized);
        }
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const handleColorPickerChange = useCallback(
    (newValue: string) => {
      // color picker always returns valid hex, update immediately
      setLocalValue(newValue);
      onChange(newValue);
    },
    [onChange]
  );

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => handleColorPickerChange(e.target.value)}
        onFocus={onPickerOpen}
        onBlur={onPickerClose}
        className="border-0 rounded-sm w-7 h-7 cursor-pointer color-picker-clean"
      />
      <span
        className="flex-1 text-xs"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </span>
      <input
        type="text"
        value={localValue}
        onChange={(e) => handleTextChange(e.target.value)}
        className="px-1.5 py-0.5 rounded focus:outline-none w-16 font-mono text-xs"
        style={{
          backgroundColor: "var(--color-background-input)",
          border: `1px solid ${
            isValidHexColor(localValue)
              ? "var(--color-border-default)"
              : "var(--color-error, #ef4444)"
          }`,
          color: "var(--color-text-primary)",
        }}
        placeholder="#000000"
      />
    </div>
  );
});
