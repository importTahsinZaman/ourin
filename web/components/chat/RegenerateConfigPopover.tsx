"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, X, Brain, Check, Search, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MODELS_BY_DATE,
  getModelInfo,
  FREE_MODEL_ID,
  type ReasoningPreset,
} from "@/lib/models";
import { useCores } from "@/hooks/useCores";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth } from "convex/react";

interface RegenerateConfigPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (model: string, reasoningLevel?: string | number) => void;
  messageModel?: string; // Model used for the message being regenerated
  messageReasoningLevel?: string | number; // Reasoning level used for the message
  messageCoreNames?: string[]; // Core names used for the message
  fallbackModel: string; // Current model as fallback if message has no model
  anchorRef: React.RefObject<HTMLElement | null>;
}

// Get default reasoning level for a model
function getDefaultReasoningLevel(modelId: string): string | number {
  const modelInfo = getModelInfo(modelId);
  if (!modelInfo.reasoningParameter) {
    return "medium";
  }
  return modelInfo.reasoningParameter.defaultValue ?? "medium";
}

export function RegenerateConfigPopover({
  isOpen,
  onClose,
  onRegenerate,
  messageModel,
  messageReasoningLevel,
  messageCoreNames,
  fallbackModel,
  anchorRef,
}: RegenerateConfigPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get user tier info to filter available models
  const { isAuthenticated } = useConvexAuth();
  const tierInfo = useQuery(
    api.billing.getUserTier,
    isAuthenticated ? {} : "skip"
  );

  // Determine which models user can access
  const canAccessAllModels =
    tierInfo?.tier === "subscriber" || tierInfo?.tier === "self_hosted";

  // Use message's model or fallback to current
  const initialModel = messageModel || fallbackModel;

  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [selectedReasoningLevel, setSelectedReasoningLevel] = useState<
    string | number
  >(messageReasoningLevel ?? getDefaultReasoningLevel(initialModel));
  const [search, setSearch] = useState("");

  // Get cores data and function to set active cores
  const { cores, setActiveCoresByIds } = useCores();

  // Local state for which cores are active (initialized from message's coreNames)
  const [localActiveCores, setLocalActiveCores] = useState<Set<string>>(
    new Set()
  );

  // Track previous isOpen to detect when popover opens
  const wasOpenRef = useRef(false);

  // Reset state when opening (only run when isOpen changes to true)
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Popover just opened
      const model = messageModel || fallbackModel;
      setSelectedModel(model);
      setSelectedReasoningLevel(
        messageReasoningLevel ?? getDefaultReasoningLevel(model)
      );
      setSearch("");

      // Initialize local active cores from message's coreNames
      if (messageCoreNames && messageCoreNames.length > 0 && cores) {
        // Match cores by name
        const activeIds = new Set<string>();
        for (const core of cores) {
          if (messageCoreNames.includes(core.name)) {
            activeIds.add(core.id);
          }
        }
        // If no matches found, fall back to currently active cores
        if (activeIds.size === 0) {
          for (const core of cores) {
            if (core.isActive) {
              activeIds.add(core.id);
            }
          }
        }
        setLocalActiveCores(activeIds);
      } else if (cores) {
        // No message cores, use currently active ones
        const activeIds = new Set<string>();
        for (const core of cores) {
          if (core.isActive) {
            activeIds.add(core.id);
          }
        }
        setLocalActiveCores(activeIds);
      }

      // Focus search input
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    wasOpenRef.current = isOpen;
  }, [
    isOpen,
    messageModel,
    messageReasoningLevel,
    messageCoreNames,
    fallbackModel,
    cores,
  ]);

  // Update reasoning level when model changes
  useEffect(() => {
    setSelectedReasoningLevel(getDefaultReasoningLevel(selectedModel));
  }, [selectedModel]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modelInfo = getModelInfo(selectedModel);
  const isReasoningModel = !!modelInfo.reasoningParameter;

  // Helper to check if user can access a model
  const canAccessModel = (modelId: string, _modelProvider: string) => {
    if (!tierInfo) return modelId === FREE_MODEL_ID;

    // Self-hosted or subscriber can access all models
    if (tierInfo.tier === "self_hosted" || tierInfo.tier === "subscriber") {
      return true;
    }

    // Free tier can only access free model
    return modelId === FREE_MODEL_ID;
  };

  // Filter models by search (show all, but some will be locked)
  const filteredModels = MODELS_BY_DATE.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  }).sort((a, b) => {
    // Put free model first for free tier users
    if (!canAccessAllModels) {
      if (a.id === FREE_MODEL_ID) return -1;
      if (b.id === FREE_MODEL_ID) return 1;
    }
    return 0;
  });

  // Filter cores by search
  const filteredCores = cores?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase())
  );

  // Get reasoning options for the selected model
  const getReasoningOptions = () => {
    if (!modelInfo.reasoningParameter) return [];

    const { kind, allowedValues, presets } = modelInfo.reasoningParameter;

    if (kind === "effort" && allowedValues) {
      return allowedValues.map((v) => ({
        key: v,
        label: v.charAt(0).toUpperCase() + v.slice(1),
        value: v,
      }));
    }

    if (presets) {
      return presets.map((p: ReasoningPreset) => ({
        key: p.key,
        label: p.label,
        value: p.value,
      }));
    }

    return [];
  };

  const reasoningOptions = getReasoningOptions();

  // Toggle local core active state
  const toggleLocalCore = (coreId: string) => {
    setLocalActiveCores((prev) => {
      const next = new Set(prev);
      if (next.has(coreId)) {
        // Don't allow deactivating all cores
        if (next.size > 1) {
          next.delete(coreId);
        }
      } else {
        next.add(coreId);
      }
      return next;
    });
  };

  const handleRegenerate = async () => {
    // Apply local core state to global before regenerating
    await setActiveCoresByIds(localActiveCores);

    onRegenerate(
      selectedModel,
      isReasoningModel ? selectedReasoningLevel : undefined
    );
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      className="z-50 absolute shadow-lg rounded-sm w-[480px] overflow-hidden"
      style={{
        backgroundColor: "var(--color-background-elevated)",
        border: "1px solid var(--color-border-default)",
        left: 0,
        bottom: "100%",
        marginBottom: "8px",
      }}
    >
      {/* Search */}
      <div
        className="p-2"
        style={{ borderBottom: "1px solid var(--color-border-muted)" }}
      >
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm"
          style={{ backgroundColor: "var(--color-background-input)" }}
        >
          <Search
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models & cores..."
            className="flex-1 bg-transparent border-none outline-none focus:outline-none ring-0 focus:ring-0 text-sm"
            style={{ color: "var(--color-text-primary)" }}
          />
          <button
            onClick={onClose}
            className="hover:bg-[var(--color-background-hover)] p-1 rounded transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex max-h-[320px]">
        {/* Models column (left) */}
        <div
          className="flex-1 p-1.5 overflow-y-auto"
          style={{ borderRight: "1px solid var(--color-border-muted)" }}
        >
          <div
            className="px-2.5 py-1 font-medium text-xs uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Model
          </div>
          {filteredModels.map((model) => {
            const isSelected = model.id === selectedModel;
            const hasAccess = canAccessModel(model.id, model.provider);
            const isLocked = !hasAccess;
            return (
              <button
                key={model.id}
                onClick={() => {
                  if (!isLocked) {
                    setSelectedModel(model.id);
                  }
                }}
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
                  {isSelected && (
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

        {/* Cores column (right) */}
        <div className="flex flex-col flex-1">
          {/* Scrollable cores list */}
          <div className="flex-1 space-y-0.5 p-1.5 overflow-y-auto">
            <div
              className="px-2.5 py-1 font-medium text-xs uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              Cores
            </div>
            {filteredCores?.map((core) => {
              const isActive = localActiveCores.has(core.id);
              return (
                <button
                  key={core.id}
                  onClick={() => toggleLocalCore(core.id)}
                  className="flex items-start gap-2 hover:bg-[var(--color-background-hover)] px-2.5 py-2 rounded-sm w-full text-left transition-colors"
                  style={{
                    backgroundColor: isActive
                      ? "var(--color-accent-primary-muted)"
                      : undefined,
                  }}
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className="font-medium text-sm truncate"
                      style={{
                        color: isActive
                          ? "var(--color-accent-primary)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {core.name}
                    </span>
                    <span
                      className="text-xs line-clamp-2"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {core.content}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Reasoning options (sticky footer, only for reasoning models) */}
          {isReasoningModel && reasoningOptions.length > 0 && (
            <div
              className="p-1.5 shrink-0"
              style={{ borderTop: "1px solid var(--color-border-muted)" }}
            >
              <div
                className="px-2.5 py-1 font-medium text-xs uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                {modelInfo.reasoningParameter?.kind === "effort"
                  ? "Reasoning"
                  : "Thinking"}
              </div>
              <div className="flex flex-wrap gap-1 px-1">
                {reasoningOptions.map((option) => {
                  const isSelected = option.value === selectedReasoningLevel;
                  return (
                    <button
                      key={option.key}
                      onClick={() => setSelectedReasoningLevel(option.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-sm text-sm transition-colors",
                        isSelected
                          ? ""
                          : "hover:bg-[var(--color-background-hover)]"
                      )}
                      style={{
                        backgroundColor: isSelected
                          ? "var(--color-accent-primary-muted)"
                          : undefined,
                        color: isSelected
                          ? "var(--color-accent-primary)"
                          : "var(--color-text-secondary)",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with regenerate button */}
      <div
        className="flex justify-end px-3 py-2"
        style={{ borderTop: "1px solid var(--color-border-muted)" }}
      >
        <button
          onClick={handleRegenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm transition-colors"
          style={{
            backgroundColor: "var(--color-accent-primary)",
            color: "var(--color-text-inverse)",
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate
        </button>
      </div>
    </div>
  );
}
