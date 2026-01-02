"use client";

import { useMemo } from "react";
import { Brain, Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS_BY_DATE, FREE_MODEL_ID, type Model } from "@/lib/models";

interface ModelListProps {
  selectedModel: string;
  onSelect: (modelId: string) => void;
  search: string;
  canAccessModel: (modelId: string) => boolean;
  getLockReason: () => string;
  canAccessAllModels: boolean;
  /** Show checkmark on selected model */
  showCheckmark?: boolean;
}

export function ModelList({
  selectedModel,
  onSelect,
  search,
  canAccessModel,
  getLockReason,
  canAccessAllModels,
  showCheckmark = false,
}: ModelListProps) {
  // Filter models by search (sorted by release date, newest first)
  // For unauthenticated or free tier users, put the free model at the top
  const filteredModels = useMemo(() => {
    const searchLower = search.toLowerCase();
    const filtered = MODELS_BY_DATE.filter(
      (m) =>
        m.name.toLowerCase().includes(searchLower) ||
        m.provider.toLowerCase().includes(searchLower) ||
        m.description.toLowerCase().includes(searchLower)
    );

    // Put free model first for users without full access
    if (!canAccessAllModels) {
      return filtered.sort((a, b) => {
        if (a.id === FREE_MODEL_ID) return -1;
        if (b.id === FREE_MODEL_ID) return 1;
        return 0;
      });
    }

    return filtered;
  }, [search, canAccessAllModels]);

  const handleSelect = (model: Model) => {
    const hasAccess = canAccessModel(model.id);
    if (!hasAccess) {
      return; // Parent should handle showing error toast
    }
    onSelect(model.id);
  };

  return (
    <div className="p-1.5">
      <div
        className="px-2.5 py-1 font-medium text-xs uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Model
      </div>
      {filteredModels.map((model) => {
        const isSelected = model.id === selectedModel;
        const hasAccess = canAccessModel(model.id);
        const isLocked = !hasAccess;

        return (
          <button
            key={model.id}
            onClick={() => handleSelect(model)}
            className={cn(
              "flex justify-between items-center gap-2 px-2.5 py-2 rounded-sm w-full text-left transition-colors",
              isLocked
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-[var(--color-background-hover)]"
            )}
            style={{
              backgroundColor: isSelected
                ? "var(--color-accent-primary-muted)"
                : undefined,
            }}
          >
            <div className="flex flex-col min-w-0">
              <span
                className="font-medium text-sm truncate"
                style={{
                  color: isSelected
                    ? "var(--color-accent-primary)"
                    : isLocked
                      ? "var(--color-text-muted)"
                      : "var(--color-text-primary)",
                }}
              >
                {model.name}
              </span>
              <span
                className="text-xs truncate"
                style={{ color: "var(--color-text-muted)" }}
              >
                {model.description}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isLocked && (
                <Lock
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--color-text-muted)" }}
                />
              )}
              {model.reasoningParameter && !isLocked && (
                <Brain
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--color-text-muted)" }}
                />
              )}
              {showCheckmark && isSelected && (
                <Check
                  className="w-4 h-4"
                  style={{ color: "var(--color-accent-primary)" }}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { MODELS_BY_DATE, FREE_MODEL_ID };
