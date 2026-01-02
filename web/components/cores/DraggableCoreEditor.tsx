"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X, GripHorizontal } from "lucide-react";
import { useCoreEditor } from "@/contexts/CoreEditorContext";
import { useCores } from "@/hooks/useCores";

export function DraggableCoreEditor() {
  const { isOpen, editingCore, position, closeEditor, setPosition } =
    useCoreEditor();

  const { createCore, updateCore } = useCores();

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const isNew = !editingCore;

  // reset form when editor opens with new values
  useEffect(() => {
    if (isOpen) {
      setName(editingCore?.name ?? "");
      setContent(editingCore?.content ?? "");
    }
  }, [isOpen, editingCore]);

  // center position on first open
  useEffect(() => {
    if (isOpen && position.x === -1 && position.y === -1 && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const centerX = Math.max(0, (window.innerWidth - rect.width) / 2);
      const centerY = Math.max(0, (window.innerHeight - rect.height) / 2);
      setPosition({ x: centerX, y: centerY });
    }
  }, [isOpen, position, setPosition]);

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        closeEditor();
      } else if (e.key === "Enter" && e.metaKey) {
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSave changes on every render, only bind on open/close and form state
  }, [isOpen, closeEditor, name, content]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !content.trim()) return;

    if (editingCore) {
      await updateCore(editingCore.id, {
        name: name.trim(),
        content: content.trim(),
      });
    } else {
      await createCore(name.trim(), content.trim());
    }
    closeEditor();
  }, [name, content, editingCore, createCore, updateCore, closeEditor]);

  // drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    e.preventDefault();
    setIsDragging(true);

    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(
        0,
        Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 300)
      );
      const newY = Math.max(
        0,
        Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 100)
      );
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, setPosition]);

  const isValid = name.trim() && content.trim();

  if (!isOpen) return null;

  // calculate position - use centered if not set
  const left = position.x >= 0 ? position.x : undefined;
  const top = position.y >= 0 ? position.y : undefined;

  return (
    <div
      ref={panelRef}
      className="z-30 fixed flex flex-col shadow-2xl rounded-sm w-[500px] h-[450px] max-h-[80vh] overflow-hidden"
      style={{
        backgroundColor: "var(--color-background-elevated)",
        border: "1px solid var(--color-border-default)",
        left: left !== undefined ? `${left}px` : "50%",
        top: top !== undefined ? `${top}px` : "50%",
        transform: left === undefined ? "translate(-50%, -50%)" : undefined,
      }}
    >
      {/* draggable header */}
      <div
        onMouseDown={handleMouseDown}
        className="flex flex-shrink-0 justify-between items-center px-3 py-2 cursor-move select-none"
        style={{
          borderBottom: "1px solid var(--color-border-muted)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal
            className="w-3.5 h-3.5"
            style={{ color: "var(--color-text-muted)" }}
          />
          <h2
            className="font-medium text-sm"
            style={{ color: "var(--color-text-primary)" }}
          >
            {isNew ? "New Core" : "Edit Core"}
          </h2>
        </div>
        <button
          onClick={closeEditor}
          className="hover:bg-[var(--color-background-hover)] p-1 rounded transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* content */}
      <div className="flex flex-col flex-1 gap-2 p-2.5 overflow-y-auto">
        {/* name input */}
        <div>
          <label
            className="block mb-1 font-medium text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Code Expert"
            autoFocus
            className="px-2.5 py-1.5 rounded-sm focus:outline-none focus:ring-1 w-full text-sm"
            style={{
              backgroundColor: "var(--color-background-input)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        {/* content textarea */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center mb-1">
            <label
              className="font-medium text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              System Prompt
            </label>
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {content.length}
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter the system prompt for this core..."
            className="flex-1 px-2.5 py-2 rounded-sm focus:outline-none focus:ring-1 w-full min-h-[220px] text-sm resize-none"
            style={{
              backgroundColor: "var(--color-background-input)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>
      </div>

      {/* footer */}
      <div
        className="flex flex-shrink-0 justify-end items-center gap-1.5 px-2.5 py-2"
        style={{ borderTop: "1px solid var(--color-border-muted)" }}
      >
        <button
          onClick={closeEditor}
          className="hover:bg-[var(--color-background-hover)] px-2.5 py-1 rounded-sm text-sm transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="px-2.5 py-1 rounded-sm font-medium text-sm transition-colors"
          style={{
            backgroundColor: isValid
              ? "var(--color-accent-primary)"
              : "var(--color-background-tertiary)",
            color: isValid
              ? "var(--color-text-inverse)"
              : "var(--color-text-muted)",
            cursor: isValid ? "pointer" : "not-allowed",
          }}
        >
          {isNew ? "Create" : "Save"}
        </button>
      </div>
    </div>
  );
}
