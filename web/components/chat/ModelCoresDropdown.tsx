"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Search, Plus, Cpu, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS_BY_DATE, getModelInfo } from "@/lib/models";
import { toast } from "sonner";
import { useCores, type Core } from "@/hooks/useCores";
import { useCoreEditor } from "@/contexts/CoreEditorContext";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useModelAccess } from "@/hooks/useModelAccess";
import { ModelList } from "./shared/ModelList";
import { CoreList } from "./shared/CoreList";

export { getModelInfo, MODELS_BY_DATE };

interface ModelCoresDropdownProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelCoresDropdown({
  selectedModel,
  onModelChange,
}: ModelCoresDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openAbove, setOpenAbove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Model access (tier checking)
  const { canAccessModel, getLockReason, canAccessAllModels } =
    useModelAccess();

  // Cores data and mutations
  const { cores, activeCoresCount, toggleActive, removeCore, reorderCores } =
    useCores();

  // Global core editor
  const { openEditor, isOpen: coreEditorOpen } = useCoreEditor();

  // System prompt preview modal
  const [previewOpen, setPreviewOpen] = useState(false);

  const modelInfo = getModelInfo(selectedModel);

  // Memoize the prompt preview
  const previewPrompt = useMemo(() => {
    if (!cores) return "No active cores";
    const activeCores = cores
      .filter((c) => c.isActive)
      .sort((a, b) => a.order - b.order);
    if (activeCores.length === 0) return "No active cores";
    return activeCores.map((c) => c.content).join("\n\n---\n\n");
  }, [cores]);

  // Close dropdown handler
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  // Close on outside click (but not when modal is open)
  useClickOutside(
    containerRef,
    closeDropdown,
    isOpen && !coreEditorOpen && !previewOpen
  );

  // Close dropdown on Escape key
  useEscapeKey(closeDropdown, isOpen && !previewOpen);

  // Close preview modal on Escape key
  useEscapeKey(() => setPreviewOpen(false), previewOpen);

  // Check if should open above and focus search
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenAbove(spaceBelow < 400);

      // Focus search input
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Model selection handler
  const handleModelSelect = useCallback(
    (modelId: string) => {
      if (!canAccessModel(modelId)) {
        const reason = getLockReason();
        toast.error("Model not available", {
          description: reason,
        });
        return;
      }
      onModelChange(modelId);
    },
    [onModelChange, canAccessModel, getLockReason]
  );

  // Core toggle
  const handleCoreToggle = useCallback(
    async (coreId: string) => {
      const success = await toggleActive(coreId);
      if (!success) {
        toast.error("At least one core must be active");
      }
    },
    [toggleActive]
  );

  // Core edit
  const handleCoreEdit = useCallback(
    (core: Core) => {
      closeDropdown();
      openEditor(core);
    },
    [openEditor, closeDropdown]
  );

  // Core delete
  const handleCoreDelete = useCallback(
    async (coreId: string) => {
      const success = await removeCore(coreId);
      if (!success) {
        toast.error("Cannot delete the only core");
      }
    },
    [removeCore]
  );

  // New core
  const handleNewCore = useCallback(() => {
    closeDropdown();
    openEditor();
  }, [openEditor, closeDropdown]);

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 hover:bg-[var(--color-background-hover)] px-2 py-1.5 rounded-sm transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <span className="font-medium text-sm">{modelInfo.name}</span>
          {activeCoresCount > 0 && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "var(--color-accent-primary-muted)",
                color: "var(--color-accent-primary)",
              }}
            >
              <Cpu className="w-3 h-3" />
              {activeCoresCount}
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              isOpen && "rotate-180"
            )}
            style={{ color: "var(--color-text-muted)" }}
          />
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div
            className={cn(
              "left-0 z-50 absolute shadow-lg rounded-sm w-[560px] overflow-hidden",
              openAbove ? "bottom-full mb-2" : "top-full mt-2"
            )}
            style={{
              backgroundColor: "var(--color-background-elevated)",
              border: "1px solid var(--color-border-default)",
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
                  placeholder="Search..."
                  className="flex-1 bg-transparent border-none outline-none focus:outline-none ring-0 focus:ring-0 text-sm"
                  style={{ color: "var(--color-text-primary)" }}
                />
              </div>
            </div>

            {/* Two-column layout */}
            <div className="flex max-h-[400px]">
              {/* Models column (left) */}
              <div
                className="flex-1 min-w-0 overflow-y-auto"
                style={{ borderRight: "1px solid var(--color-border-muted)" }}
              >
                <ModelList
                  selectedModel={selectedModel}
                  onSelect={handleModelSelect}
                  search={search}
                  canAccessModel={canAccessModel}
                  canAccessAllModels={canAccessAllModels}
                />
              </div>

              {/* Cores column (right) */}
              <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <CoreList
                  cores={cores}
                  search={search}
                  onToggle={handleCoreToggle}
                  onEdit={handleCoreEdit}
                  onDelete={handleCoreDelete}
                  onReorder={reorderCores}
                  showInfoTooltip
                />

                {/* Sticky footer buttons */}
                <div
                  className="flex gap-1 p-1.5 shrink-0"
                  style={{ borderTop: "1px solid var(--color-border-muted)" }}
                >
                  <button
                    onClick={handleNewCore}
                    className="flex flex-1 justify-center items-center gap-1.5 hover:bg-[var(--color-background-hover)] px-2 py-1.5 rounded-sm text-sm transition-colors"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <Plus className="w-4 h-4" />
                    New Core
                  </button>
                  <button
                    onClick={() => setPreviewOpen(true)}
                    className="flex flex-1 justify-center items-center gap-1.5 hover:bg-[var(--color-background-hover)] px-2 py-1.5 rounded-sm text-sm transition-colors"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <FileText className="w-4 h-4" />
                    View Prompt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System prompt preview modal */}
      {previewOpen && (
        <div
          className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="flex flex-col shadow-xl rounded-sm w-full max-w-2xl max-h-[80vh]"
            style={{
              backgroundColor: "var(--color-background-elevated)",
              border: "1px solid var(--color-border-default)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex justify-between items-center px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid var(--color-border-muted)" }}
            >
              <h2
                className="font-semibold text-lg"
                style={{ color: "var(--color-text-primary)" }}
              >
                Current System Prompt
              </h2>
              <button
                onClick={() => setPreviewOpen(false)}
                className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto">
              <pre
                className="font-mono text-sm whitespace-pre-wrap"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {previewPrompt}
              </pre>
            </div>

            {/* Footer */}
            <div
              className="px-4 py-3 shrink-0"
              style={{ borderTop: "1px solid var(--color-border-muted)" }}
            >
              <p
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                This is the combined system prompt from all active cores.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
