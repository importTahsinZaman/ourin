"use client";

import { useState, useCallback } from "react";
import { Pencil, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Core } from "@/hooks/useCores";

interface CoreListProps {
  cores: Core[] | undefined;
  search: string;
  /** Function to determine if a core is active. Defaults to core.isActive */
  getIsActive?: (core: Core) => boolean;
  onToggle: (coreId: string) => void;
  /** Optional edit handler - if provided, shows edit button */
  onEdit?: (core: Core) => void;
  /** Optional delete handler - if provided, shows delete button */
  onDelete?: (coreId: string) => void;
  /** Optional reorder handler - if provided, enables drag-to-reorder */
  onReorder?: (orderedIds: string[]) => Promise<boolean | void>;
  /** Show info tooltip about cores */
  showInfoTooltip?: boolean;
}

export function CoreList({
  cores,
  search,
  getIsActive,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
  showInfoTooltip = false,
}: CoreListProps) {
  // Drag state for reordering
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Filter cores by search
  const filteredCores = cores?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase())
  );

  // Drag handlers
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
    if (draggedId && dragOverId && cores && onReorder) {
      const orderedIds = cores.map((c) => c.id);
      const draggedIndex = orderedIds.indexOf(draggedId);
      const dropIndex = orderedIds.indexOf(dragOverId);

      if (draggedIndex !== -1 && dropIndex !== -1) {
        orderedIds.splice(draggedIndex, 1);
        orderedIds.splice(dropIndex, 0, draggedId);
        try {
          await onReorder(orderedIds);
        } catch (error) {
          console.error("Failed to reorder cores:", error);
        }
      }
    }
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, dragOverId, cores, onReorder]);

  const isActive = (core: Core) => {
    return getIsActive ? getIsActive(core) : core.isActive;
  };

  const hasCrudActions = onEdit || onDelete;
  const isDraggable = !!onReorder;

  return (
    <div className="flex-1 space-y-0.5 p-1.5 overflow-y-auto min-h-0">
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 font-medium text-xs uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Cores
        {showInfoTooltip && (
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
              Ourin Cores are custom system prompt snippets that empower Ourin
              with rich context, expert playbooks, personalized behavior, and
              more.
            </div>
          </div>
        )}
      </div>
      {filteredCores?.map((core) => {
        const active = isActive(core);
        return (
          <div
            key={core.id}
            draggable={isDraggable}
            onDragStart={
              isDraggable ? (e) => handleDragStart(e, core.id) : undefined
            }
            onDragOver={
              isDraggable ? (e) => handleDragOver(e, core.id) : undefined
            }
            onDragEnd={isDraggable ? handleDragEnd : undefined}
            onClick={() => onToggle(core.id)}
            className={cn(
              "group/core flex items-start gap-2 hover:bg-[var(--color-background-hover)] px-2.5 py-2 rounded-sm w-full text-left transition-colors cursor-pointer",
              isDraggable && draggedId === core.id && "opacity-50",
              isDraggable &&
                dragOverId === core.id &&
                "ring-2 ring-[var(--color-accent-primary)]"
            )}
            style={{
              backgroundColor: active
                ? "var(--color-accent-primary-muted)"
                : undefined,
            }}
          >
            <div className="flex flex-col flex-1 min-w-0">
              <span
                className="font-medium text-sm truncate"
                style={{
                  color: active
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
            {hasCrudActions && (
              <div className="flex items-center gap-0.5 shrink-0">
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(core);
                    }}
                    className="hover:bg-[var(--color-background-tertiary)] opacity-0 group-hover/core:opacity-100 p-1 rounded transition-all"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(core.id);
                    }}
                    className="hover:bg-red-500/10 opacity-0 group-hover/core:opacity-100 p-1 rounded text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
