"use client";

import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";

interface CoreEditorModalProps {
  isOpen: boolean;
  initialName?: string;
  initialContent?: string;
  onSave: (name: string, content: string) => void;
  onCancel: () => void;
  isNew?: boolean;
}

export function CoreEditorModal({
  isOpen,
  initialName = "",
  initialContent = "",
  onSave,
  onCancel,
  isNew = false,
}: CoreEditorModalProps) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);

  // Reset form when modal opens with new values
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setContent(initialContent);
    }
  }, [isOpen, initialName, initialContent]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && e.metaKey) {
        handleSave();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSave = useCallback(() => {
    if (name.trim() && content.trim()) {
      onSave(name.trim(), content.trim());
    }
  }, [name, content, onSave]);

  const isValid = name.trim() && content.trim();

  if (!isOpen) return null;

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div
        className="z-10 relative flex flex-col shadow-2xl mx-4 rounded-sm w-full max-w-2xl max-h-[80vh] overflow-hidden animate-slide-up"
        style={{
          backgroundColor: "var(--color-background-elevated)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 justify-between items-center px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border-muted)" }}
        >
          <h2
            className="font-semibold text-lg"
            style={{ color: "var(--color-text-primary)" }}
          >
            {isNew ? "New Core" : "Edit Core"}
          </h2>
          <button
            onClick={onCancel}
            className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Name input */}
          <div className="mb-4">
            <label
              className="block mb-2 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Code Expert, Writing Coach"
              autoFocus
              className="px-3 py-2 rounded-sm focus:outline-none focus:ring-2 w-full text-sm"
              style={{
                backgroundColor: "var(--color-background-input)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          {/* Content textarea */}
          <div className="mb-4">
            <label
              className="block mb-2 font-medium text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              System Prompt
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the system prompt for this core. This will customize how the AI behaves and responds..."
              rows={12}
              className="px-3 py-2 rounded-sm focus:outline-none focus:ring-2 w-full text-sm resize-none"
              style={{
                backgroundColor: "var(--color-background-input)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
            <div className="mt-1 text-right">
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {content.length} characters
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex flex-shrink-0 justify-end items-center gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--color-border-muted)" }}
        >
          <button
            onClick={onCancel}
            className="hover:bg-[var(--color-background-hover)] px-4 py-2 rounded-sm font-medium text-sm transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-4 py-2 rounded-sm font-medium text-sm transition-colors"
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
            {isNew ? "Create Core" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
