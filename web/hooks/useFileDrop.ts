"use client";

import { useState, useCallback, useRef, useMemo } from "react";

interface UseFileDropOptions {
  onDrop: (files: File[]) => void;
  disabled?: boolean;
}

interface UseFileDropReturn {
  isDragging: boolean;
  dropHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Hook for handling file drag-and-drop functionality.
 *
 * Handles the common gotchas of drag-and-drop:
 * - Nested element events causing flicker (uses counter approach)
 * - Preventing default browser behavior
 * - Filtering for file drags only
 */
export function useFileDrop({
  onDrop,
  disabled = false,
}: UseFileDropOptions): UseFileDropReturn {
  const [isDragging, setIsDragging] = useState(false);
  // Counter to handle nested element drag events
  // Increments on dragenter, decrements on dragleave
  // Only show overlay when counter > 0
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      // Check if the drag contains files
      if (!e.dataTransfer.types.includes("Files")) return;

      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      // Set the drop effect
      if (e.dataTransfer.types.includes("Files")) {
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset state
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      onDrop(files);
    },
    [disabled, onDrop]
  );

  const dropHandlers = useMemo(
    () => ({
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    }),
    [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]
  );

  return {
    isDragging,
    dropHandlers,
  };
}
