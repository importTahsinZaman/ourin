"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  Brain,
  Search,
  Pencil,
  Trash2,
  Plus,
  Cpu,
  Info,
  FileText,
  X,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS_BY_DATE, getModelInfo, FREE_MODEL_ID } from "@/lib/models";
import { toast } from "sonner";
import { useCores, type Core } from "@/hooks/useCores";
import { useCoreEditor } from "@/contexts/CoreEditorContext";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export { getModelInfo };

interface ModelCoresDropdownProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  isAuthenticated: boolean;
}

export function ModelCoresDropdown({
  selectedModel,
  onModelChange,
  isAuthenticated,
}: ModelCoresDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openAbove, setOpenAbove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // get user tier info
  const tierInfo = useQuery(api.billing.getUserTier);

  // cores data and mutations (works for both logged-in and anonymous users)
  const { cores, activeCoresCount, toggleActive, removeCore, reorderCores } =
    useCores();

  // helper to check if user can access a model based on their tier
  const canAccessModel = useCallback(
    (modelId: string, _modelProvider: string) => {
      // not authenticated - only free model
      if (!isAuthenticated) {
        return modelId === FREE_MODEL_ID;
      }

      // loading tier info - be permissive
      if (!tierInfo) {
        return true;
      }

      // anonymous or free tier - only free model
      if (tierInfo.tier === "anonymous" || tierInfo.tier === "free") {
        return modelId === FREE_MODEL_ID;
      }

      // subscriber or self-hosted - all models
      if (tierInfo.tier === "subscriber" || tierInfo.tier === "self_hosted") {
        return true;
      }

      return modelId === FREE_MODEL_ID;
    },
    [isAuthenticated, tierInfo]
  );

  // get reason why model is locked
  const getLockReason = useCallback(
    (_modelProvider: string) => {
      if (!isAuthenticated) {
        return "Sign in to access this model";
      }
      if (!tierInfo) {
        return "";
      }
      // self-hosted and subscriber have full access - no lock reason
      if (tierInfo.tier === "self_hosted" || tierInfo.tier === "subscriber") {
        return "";
      }
      if (tierInfo.tier === "anonymous" || tierInfo.tier === "free") {
        return "Subscribe to access this model";
      }
      return "";
    },
    [isAuthenticated, tierInfo]
  );

  // global core editor
  const { openEditor, isOpen: coreEditorOpen } = useCoreEditor();

  // drag state for reordering
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // system prompt preview modal
  const [previewOpen, setPreviewOpen] = useState(false);

  const modelInfo = getModelInfo(selectedModel);

  // filter models by search (sorted by release date, newest first)
  // for unauthenticated or free tier users, put the free model at the top
  const filteredModels = useMemo(() => {
    const searchLower = search.toLowerCase();
    const filtered = MODELS_BY_DATE.filter(
      (m) =>
        m.name.toLowerCase().includes(searchLower) ||
        m.provider.toLowerCase().includes(searchLower) ||
        m.description.toLowerCase().includes(searchLower)
    );

    // put free model first for unauthenticated or free tier users
    const shouldPrioritizeFreeModel =
      !isAuthenticated ||
      tierInfo?.tier === "anonymous" ||
      tierInfo?.tier === "free";

    if (shouldPrioritizeFreeModel) {
      return filtered.sort((a, b) => {
        if (a.id === FREE_MODEL_ID) return -1;
        if (b.id === FREE_MODEL_ID) return 1;
        return 0;
      });
    }

    return filtered;
  }, [search, isAuthenticated, tierInfo?.tier]);

  // filter cores by search
  const filteredCores = useMemo(() => {
    if (!cores) return undefined;
    const searchLower = search.toLowerCase();
    return cores.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.content.toLowerCase().includes(searchLower)
    );
  }, [cores, search]);

  // memoize the prompt preview (uses separators for visual display)
  const previewPrompt = useMemo(() => {
    if (!cores) return "No active cores";
    const activeCores = cores
      .filter((c) => c.isActive)
      .sort((a, b) => a.order - b.order);
    if (activeCores.length === 0) return "No active cores";
    return activeCores.map((c) => c.content).join("\n\n---\n\n");
  }, [cores]);

  // close on outside click (but not when modal is open)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (coreEditorOpen || previewOpen) return;
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [coreEditorOpen, previewOpen]);

  // check if should open above and focus search
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenAbove(spaceBelow < 400);

      // focus search input
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // close modal on escape key
  useEffect(() => {
    if (!previewOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [previewOpen]);

  // close dropdown on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // model selection - keeps dropdown open
  const handleModelSelect = useCallback(
    (modelId: string, modelProvider: string) => {
      // check if user can select this model based on their tier
      if (!canAccessModel(modelId, modelProvider)) {
        const reason = getLockReason(modelProvider);
        toast.error("Model not available", {
          description: reason,
        });
        return;
      }
      onModelChange(modelId);
    },
    [onModelChange, canAccessModel, getLockReason]
  );

  // core toggle - keeps dropdown open
  const handleCoreToggle = useCallback(
    async (coreId: string) => {
      const success = await toggleActive(coreId);
      if (!success) {
        toast.error("At least one core must be active");
      }
    },
    [toggleActive]
  );

  // core edit
  const handleCoreEdit = useCallback(
    (core: Core) => {
      setIsOpen(false);
      setSearch("");
      openEditor(core);
    },
    [openEditor]
  );

  // core delete
  const handleCoreDelete = useCallback(
    async (coreId: string) => {
      const success = await removeCore(coreId);
      if (!success) {
        toast.error("Cannot delete the only core");
      }
    },
    [removeCore]
  );

  // new core
  const handleNewCore = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    openEditor();
  }, [openEditor]);

  // drag handlers for reordering
  const handleDragStart = useCallback((e: React.DragEvent, coreId: string) => {
    setDraggedId(coreId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, coreId: string) => {
      e.preventDefault();
      if (draggedId && draggedId !== coreId) {
        setDragOverId(coreId);
      }
    },
    [draggedId]
  );

  const handleDragEnd = useCallback(async () => {
    if (draggedId && dragOverId && cores) {
      const orderedIds = cores.map((c) => c.id);
      const draggedIndex = orderedIds.indexOf(draggedId);
      const dropIndex = orderedIds.indexOf(dragOverId);

      if (draggedIndex !== -1 && dropIndex !== -1) {
        orderedIds.splice(draggedIndex, 1);
        orderedIds.splice(dropIndex, 0, draggedId);
        await reorderCores(orderedIds);
      }
    }
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, dragOverId, cores, reorderCores]);

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* trigger button */}
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

        {/* dropdown menu */}
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
            {/* search */}
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

            {/* two-column layout */}
            <div className="flex max-h-[400px]">
              {/* models column (left) */}
              <div
                className="flex-1 p-1.5 min-w-0 overflow-y-auto"
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
                      onClick={() =>
                        handleModelSelect(model.id, model.provider)
                      }
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
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* cores column (right) */}
              <div className="flex flex-col flex-1 min-w-0">
                {/* scrollable cores list */}
                <div className="flex-1 space-y-0.5 p-1.5 overflow-y-auto">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 font-medium text-xs uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Cores
                    <div className="group/tooltip relative">
                      <Info className="w-3 h-3 cursor-help" />
                      <div
                        className="top-full left-0 z-[9999] absolute opacity-0 group-hover/tooltip:opacity-100 shadow-lg mt-1.5 px-2.5 py-1.5 rounded-sm w-48 text-xs normal-case tracking-normal whitespace-normal transition-opacity pointer-events-none"
                        style={{
                          backgroundColor: "var(--color-background-elevated)",
                          border: "1px solid var(--color-border-default)",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        Ourin Cores are custom system prompt snippets that
                        empower Ourin with rich context, expert playbooks,
                        personalized behavior, and more.
                      </div>
                    </div>
                  </div>
                  {filteredCores?.map((core) => (
                    <div
                      key={core.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, core.id)}
                      onDragOver={(e) => handleDragOver(e, core.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleCoreToggle(core.id)}
                      className={cn(
                        "group/core flex items-start gap-2 hover:bg-[var(--color-background-hover)] px-2.5 py-2 rounded-sm w-full text-left transition-colors cursor-pointer",
                        draggedId === core.id && "opacity-50",
                        dragOverId === core.id &&
                          "ring-2 ring-[var(--color-accent-primary)]"
                      )}
                      style={{
                        backgroundColor: core.isActive
                          ? "var(--color-accent-primary-muted)"
                          : undefined,
                      }}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span
                          className="font-medium text-sm truncate"
                          style={{
                            color: core.isActive
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
                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* edit/delete (visible on hover) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCoreEdit(core);
                          }}
                          className="hover:bg-[var(--color-background-tertiary)] opacity-0 group-hover/core:opacity-100 p-1 rounded transition-all"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCoreDelete(core.id);
                          }}
                          className="hover:bg-red-500/10 opacity-0 group-hover/core:opacity-100 p-1 rounded text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* sticky footer buttons */}
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

      {/* system prompt preview modal */}
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
            {/* header */}
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

            {/* content */}
            <div className="flex-1 p-4 overflow-y-auto">
              <pre
                className="font-mono text-sm whitespace-pre-wrap"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {previewPrompt}
              </pre>
            </div>

            {/* footer */}
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

export { MODELS_BY_DATE };
