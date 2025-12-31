/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFileDrop } from "@/hooks/useFileDrop";

// Helper to create mock DragEvent
function createDragEvent(
  type: string,
  options: { files?: File[]; hasFiles?: boolean } = {}
): React.DragEvent {
  const { files = [], hasFiles = true } = options;

  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      types: hasFiles ? ["Files"] : ["text/plain"],
      files,
      dropEffect: "none",
    },
  } as unknown as React.DragEvent;
}

// Helper to create a mock File
function createMockFile(name: string, type: string, size: number = 1024): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

describe("useFileDrop", () => {
  let onDrop: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDrop = vi.fn();
  });

  describe("initial state", () => {
    it("should not be dragging initially", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      expect(result.current.isDragging).toBe(false);
    });

    it("should provide all drop handlers", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      expect(result.current.dropHandlers).toHaveProperty("onDragEnter");
      expect(result.current.dropHandlers).toHaveProperty("onDragOver");
      expect(result.current.dropHandlers).toHaveProperty("onDragLeave");
      expect(result.current.dropHandlers).toHaveProperty("onDrop");
    });
  });

  describe("drag enter", () => {
    it("should set isDragging to true when files are dragged", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      const event = createDragEvent("dragenter");

      act(() => {
        result.current.dropHandlers.onDragEnter(event);
      });

      expect(result.current.isDragging).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("should not set isDragging when non-file content is dragged", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      const event = createDragEvent("dragenter", { hasFiles: false });

      act(() => {
        result.current.dropHandlers.onDragEnter(event);
      });

      expect(result.current.isDragging).toBe(false);
    });

    it("should not set isDragging when disabled", () => {
      const { result } = renderHook(() =>
        useFileDrop({ onDrop, disabled: true })
      );
      const event = createDragEvent("dragenter");

      act(() => {
        result.current.dropHandlers.onDragEnter(event);
      });

      expect(result.current.isDragging).toBe(false);
    });
  });

  describe("drag over", () => {
    it("should set dropEffect to copy for file drags", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      const event = createDragEvent("dragover");

      act(() => {
        result.current.dropHandlers.onDragOver(event);
      });

      expect(event.dataTransfer.dropEffect).toBe("copy");
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("should not set dropEffect when disabled", () => {
      const { result } = renderHook(() =>
        useFileDrop({ onDrop, disabled: true })
      );
      const event = createDragEvent("dragover");

      act(() => {
        result.current.dropHandlers.onDragOver(event);
      });

      expect(event.dataTransfer.dropEffect).toBe("none");
    });
  });

  describe("drag leave", () => {
    it("should set isDragging to false when leaving", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      const enterEvent = createDragEvent("dragenter");
      const leaveEvent = createDragEvent("dragleave");

      act(() => {
        result.current.dropHandlers.onDragEnter(enterEvent);
      });
      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.dropHandlers.onDragLeave(leaveEvent);
      });
      expect(result.current.isDragging).toBe(false);
    });

    it("should handle nested element events correctly", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));

      // Simulate entering parent, then child (nested enter)
      act(() => {
        result.current.dropHandlers.onDragEnter(createDragEvent("dragenter"));
      });
      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.dropHandlers.onDragEnter(createDragEvent("dragenter"));
      });
      expect(result.current.isDragging).toBe(true);

      // Simulate leaving child (should still be dragging over parent)
      act(() => {
        result.current.dropHandlers.onDragLeave(createDragEvent("dragleave"));
      });
      expect(result.current.isDragging).toBe(true);

      // Simulate leaving parent (should now be false)
      act(() => {
        result.current.dropHandlers.onDragLeave(createDragEvent("dragleave"));
      });
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe("drop", () => {
    it("should call onDrop with files when dropped", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      const file = createMockFile("test.png", "image/png");
      const event = createDragEvent("drop", { files: [file] });

      // First drag enter to set state
      act(() => {
        result.current.dropHandlers.onDragEnter(createDragEvent("dragenter"));
      });

      act(() => {
        result.current.dropHandlers.onDrop(event);
      });

      expect(onDrop).toHaveBeenCalledWith([file]);
      expect(result.current.isDragging).toBe(false);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("should not call onDrop when disabled", () => {
      const { result } = renderHook(() =>
        useFileDrop({ onDrop, disabled: true })
      );
      const file = createMockFile("test.png", "image/png");
      const event = createDragEvent("drop", { files: [file] });

      act(() => {
        result.current.dropHandlers.onDrop(event);
      });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it("should not call onDrop when no files are dropped", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      const event = createDragEvent("drop", { files: [] });

      act(() => {
        result.current.dropHandlers.onDrop(event);
      });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it("should reset isDragging after drop", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));
      const file = createMockFile("test.png", "image/png");

      // Simulate drag sequence
      act(() => {
        result.current.dropHandlers.onDragEnter(createDragEvent("dragenter"));
        result.current.dropHandlers.onDragEnter(createDragEvent("dragenter"));
      });
      expect(result.current.isDragging).toBe(true);

      // Drop should reset even with nested counter > 1
      act(() => {
        result.current.dropHandlers.onDrop(
          createDragEvent("drop", { files: [file] })
        );
      });
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe("multiple files", () => {
    it("should pass all files to onDrop regardless of type", () => {
      const { result } = renderHook(() => useFileDrop({ onDrop }));

      const pngFile = createMockFile("test.png", "image/png");
      const pdfFile = createMockFile("test.pdf", "application/pdf");
      const exeFile = createMockFile("test.exe", "application/x-msdownload");
      const event = createDragEvent("drop", {
        files: [pngFile, pdfFile, exeFile],
      });

      act(() => {
        result.current.dropHandlers.onDrop(event);
      });

      // All files passed - consumer is responsible for validation
      expect(onDrop).toHaveBeenCalledWith([pngFile, pdfFile, exeFile]);
    });
  });

  describe("memoization", () => {
    it("should return stable dropHandlers reference", () => {
      const { result, rerender } = renderHook(() => useFileDrop({ onDrop }));

      const firstHandlers = result.current.dropHandlers;
      rerender();
      const secondHandlers = result.current.dropHandlers;

      expect(firstHandlers).toBe(secondHandlers);
    });

    it("should update handlers when dependencies change", () => {
      const onDrop1 = vi.fn();
      const onDrop2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ onDrop }) => useFileDrop({ onDrop }),
        { initialProps: { onDrop: onDrop1 } }
      );

      const firstHandlers = result.current.dropHandlers;
      rerender({ onDrop: onDrop2 });
      const secondHandlers = result.current.dropHandlers;

      expect(firstHandlers).not.toBe(secondHandlers);
    });
  });
});
