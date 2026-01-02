"use client";

import { useState, useRef, useEffect } from "react";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getModelInfo,
  canDisableReasoning,
  type ReasoningPreset,
} from "@/lib/models";

interface ReasoningDropdownProps {
  selectedModel: string;
  reasoningLevel: string | number;
  onReasoningLevelChange: (level: string | number) => void;
}

export function ReasoningDropdown({
  selectedModel,
  reasoningLevel,
  onReasoningLevelChange,
}: ReasoningDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const modelInfo = getModelInfo(selectedModel);

  // close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // check if should open above
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenAbove(spaceBelow < 200);
    }
  }, [isOpen]);

  // don't render if model doesn't support reasoning
  if (!modelInfo.reasoningParameter) {
    return null;
  }

  const { kind, allowedValues, presets } = modelInfo.reasoningParameter;
  const allowOff = canDisableReasoning(selectedModel);
  const isOff = reasoningLevel === "off";

  // get display options based on kind
  const options: Array<{ key: string; label: string; value: string | number }> =
    kind === "effort" && allowedValues
      ? allowedValues.map((v) => ({
          key: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
          value: v,
        }))
      : (presets?.map((p: ReasoningPreset) => ({
          key: p.key,
          label: p.label,
          value: p.value,
        })) ?? []);

  // find current selection label
  const currentOption = options.find((o) => o.value === reasoningLevel);
  const currentLabel = isOff ? "Off" : (currentOption?.label ?? "Medium");

  const handleSelect = (value: string | number) => {
    onReasoningLevelChange(value);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors",
          isOpen && "bg-[var(--color-background-hover)]",
          !isOff && "bg-[var(--color-accent-primary-muted)]"
        )}
        style={{
          color: isOff
            ? "var(--color-text-muted)"
            : "var(--color-accent-primary)",
        }}
        title={`Reasoning: ${currentLabel}`}
      >
        <Brain className="w-4 h-4" />
      </button>

      {/* dropdown menu */}
      {isOpen && (
        <div
          className={cn(
            "left-0 z-50 absolute shadow-lg rounded-sm min-w-[160px] overflow-hidden",
            openAbove ? "bottom-full mb-2" : "top-full mt-2"
          )}
          style={{
            backgroundColor: "var(--color-background-elevated)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {/* header */}
          <div
            className="px-3 py-2"
            style={{ borderBottom: "1px solid var(--color-border-muted)" }}
          >
            <span
              className="font-medium text-xs uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {kind === "effort" ? "Reasoning Effort" : "Thinking Budget"}
            </span>
          </div>

          {/* options */}
          <div className="p-1">
            {/* off option - only for models that allow disabling */}
            {allowOff && (
              <button
                onClick={() => handleSelect("off")}
                className="flex justify-between items-center gap-2 hover:bg-[var(--color-background-hover)] px-3 py-2 rounded-sm w-full text-left transition-colors"
                style={{
                  backgroundColor: isOff
                    ? "var(--color-accent-primary-muted)"
                    : undefined,
                }}
              >
                <span
                  className="text-sm"
                  style={{
                    color: isOff
                      ? "var(--color-accent-primary)"
                      : "var(--color-text-primary)",
                  }}
                >
                  Off
                </span>
              </button>
            )}
            {options.map((option) => {
              const isSelected = option.value === reasoningLevel;
              return (
                <button
                  key={option.key}
                  onClick={() => handleSelect(option.value)}
                  className="flex justify-between items-center gap-2 hover:bg-[var(--color-background-hover)] px-3 py-2 rounded-sm w-full text-left transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? "var(--color-accent-primary-muted)"
                      : undefined,
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      color: isSelected
                        ? "var(--color-accent-primary)"
                        : "var(--color-text-primary)",
                    }}
                  >
                    {option.label}
                  </span>
                  {kind === "budget" && typeof option.value === "number" && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {(option.value / 1000).toFixed(0)}k
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
