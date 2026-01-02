"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Check, Trash2, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_COLORS = [
  { name: "Red", value: "#e63946" },
  { name: "Orange", value: "#f4a261" },
  { name: "Green", value: "#2a9d8f" },
  { name: "Blue", value: "#457b9d" },
  { name: "Purple", value: "#7c3aed" },
];

// Helper to determine if a color is light or dark
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

const BRUSH_SIZES = [
  { name: "Small", value: 3 },
  { name: "Medium", value: 6 },
  { name: "Large", value: 12 },
];

interface DrawingEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File, preview: string) => void;
  initialImage?: string;
}

// Pencil Icon - Excalidraw style
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g strokeWidth="1.25">
        <path
          clipRule="evenodd"
          d="m7.643 15.69 7.774-7.773a2.357 2.357 0 1 0-3.334-3.334L4.31 12.357a3.333 3.333 0 0 0-.977 2.357v1.953h1.953c.884 0 1.732-.352 2.357-.977Z"
        />
        <path d="m11.25 5.417 3.333 3.333" />
      </g>
    </svg>
  );
}

// Eraser Icon - Excalidraw style
function EraserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g strokeWidth="1.5">
        <path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" />
        <path d="M18 13.3l-6.3 -6.3" />
      </g>
    </svg>
  );
}

export function DrawingEditor({
  isOpen,
  onClose,
  onSave,
  initialImage,
}: DrawingEditorProps) {
  const [color, setColor] = useState("#1a1a1a");
  const [brushSize, setBrushSize] = useState(6);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isLightBg, setIsLightBg] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const canvasBgRef = useRef<string>("#FFFFFF");
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Build colors array based on canvas background
  const colors = [
    isLightBg
      ? { name: "Black", value: "#1a1a1a" }
      : { name: "White", value: "#ffffff" },
    ...BASE_COLORS,
  ];

  // Update undo/redo button states
  const updateHistoryState = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  // Save current canvas state to history
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Remove any redo states when new action is performed
    historyRef.current = historyRef.current.slice(
      0,
      historyIndexRef.current + 1
    );

    // Add new state
    historyRef.current.push(imageData);
    historyIndexRef.current = historyRef.current.length - 1;

    // Limit history to 50 states to prevent memory issues
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }

    updateHistoryState();
  }, [updateHistoryState]);

  // Undo last action
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    historyIndexRef.current--;
    const imageData = historyRef.current[historyIndexRef.current];
    ctx.putImageData(imageData, 0, 0);

    updateHistoryState();
  }, [updateHistoryState]);

  // Redo last undone action
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    historyIndexRef.current++;
    const imageData = historyRef.current[historyIndexRef.current];
    ctx.putImageData(imageData, 0, 0);

    updateHistoryState();
  }, [updateHistoryState]);

  // Get canvas background color from theme
  const getCanvasBgColor = useCallback(() => {
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-background-primary")
      .trim();
    return bgColor || "#FFFFFF";
  }, []);

  // Initialize canvas with theme background
  const initCanvas = useCallback(
    (loadImage?: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }

      canvasBgRef.current = getCanvasBgColor();
      ctx.fillStyle = canvasBgRef.current;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Determine if background is light and set appropriate default stroke color
      const bgIsLight = isLightColor(canvasBgRef.current);
      setIsLightBg(bgIsLight);
      setColor(bgIsLight ? "#1a1a1a" : "#ffffff");

      // Reset history
      historyRef.current = [];
      historyIndexRef.current = -1;

      const saveInitialState = () => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        historyRef.current = [imageData];
        historyIndexRef.current = 0;
        updateHistoryState();
      };

      if (loadImage) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const scale = Math.min(
            canvas.width / img.width,
            canvas.height / img.height,
            1
          );
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const x = (canvas.width - scaledWidth) / 2;
          const y = (canvas.height - scaledHeight) / 2;
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
          saveInitialState();
        };
        img.src = loadImage;
      } else {
        saveInitialState();
      }
    },
    [getCanvasBgColor, updateHistoryState]
  );

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        initCanvas(initialImage);
      });
    }
  }, [isOpen, initCanvas, initialImage]);

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = canvasBgRef.current;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColorPicker]);

  const getPosition = useCallback(
    (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const drawLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = isErasing ? canvasBgRef.current : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    },
    [color, brushSize, isErasing]
  );

  const handleDrawStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pos = getPosition(e);
      if (!pos) return;

      setIsDrawing(true);
      lastPosRef.current = pos;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = isErasing ? canvasBgRef.current : color;
      ctx.fill();
    },
    [getPosition, brushSize, color, isErasing]
  );

  const handleDrawMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();

      const pos = getPosition(e);
      if (!pos || !lastPosRef.current) return;

      drawLine(lastPosRef.current, pos);
      lastPosRef.current = pos;
    },
    [isDrawing, getPosition, drawLine]
  );

  const handleDrawEnd = useCallback(() => {
    if (isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
    lastPosRef.current = null;
  }, [isDrawing, saveToHistory]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = canvasBgRef.current;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  }, [saveToHistory]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const file = new File([blob], `drawing-${timestamp}.png`, {
          type: "image/png",
        });
        const preview = URL.createObjectURL(blob);

        onSave(file, preview);
        onClose();
      },
      "image/png",
      1.0
    );
  }, [onSave, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleSave, handleUndo, handleRedo]);

  if (!isOpen) return null;

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="z-10 relative flex flex-col shadow-2xl rounded-2xl w-full overflow-hidden"
        style={{
          backgroundColor: "var(--color-background-secondary)",
          border: "1px solid var(--color-border-default)",
          maxWidth: "845px",
          height: "min(660px, 77vh)",
        }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-muted)" }}
        >
          <span
            className="font-medium text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {initialImage ? "Edit Drawing" : "New Drawing"}
          </span>
          <div className="flex items-center gap-1">
            {/* Undo */}
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="hover:bg-[var(--color-background-hover)] disabled:opacity-30 p-1.5 rounded-sm transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              title="Undo (⌘Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            {/* Redo */}
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="hover:bg-[var(--color-background-hover)] disabled:opacity-30 p-1.5 rounded-sm transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 hover:bg-[var(--color-background-hover)] px-2.5 py-1.5 rounded-sm text-xs transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={onClose}
              className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="relative flex-1 m-3 rounded-sm overflow-hidden"
          style={{ border: "1px solid var(--color-border-muted)" }}
        >
          <canvas
            ref={canvasRef}
            className="block w-full h-full touch-none"
            style={{
              cursor: isErasing ? "cell" : "crosshair",
              backgroundColor: "var(--color-background-primary)",
            }}
            onMouseDown={handleDrawStart}
            onMouseMove={handleDrawMove}
            onMouseUp={handleDrawEnd}
            onMouseLeave={handleDrawEnd}
            onTouchStart={handleDrawStart}
            onTouchMove={handleDrawMove}
            onTouchEnd={handleDrawEnd}
          />

          {/* Floating Toolbar */}
          <div
            className="bottom-4 left-1/2 absolute flex items-center gap-0.5 shadow-lg px-1.5 py-1 rounded-sm -translate-x-1/2"
            style={{
              backgroundColor: "var(--color-background-elevated)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            {/* Pencil Tool */}
            <button
              onClick={() => setIsErasing(false)}
              className="flex justify-center items-center rounded-sm w-9 h-9 transition-colors"
              style={{
                backgroundColor: !isErasing
                  ? "var(--color-background-hover)"
                  : "transparent",
                color: !isErasing
                  ? "var(--color-text-primary)"
                  : "var(--color-text-muted)",
              }}
              title="Pencil"
            >
              <PencilIcon className="w-5 h-5" />
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => setIsErasing(true)}
              className="flex justify-center items-center rounded-sm w-9 h-9 transition-colors"
              style={{
                backgroundColor: isErasing
                  ? "var(--color-background-hover)"
                  : "transparent",
                color: isErasing
                  ? "var(--color-text-primary)"
                  : "var(--color-text-muted)",
              }}
              title="Eraser"
            >
              <EraserIcon className="w-5 h-5" />
            </button>

            {/* Divider */}
            <div
              className="mx-2 w-px h-6"
              style={{ backgroundColor: "var(--color-border-muted)" }}
            />

            {/* Color Picker */}
            <div className="relative" ref={colorPickerRef}>
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex justify-center items-center rounded-sm w-8 h-8 transition-colors"
                style={{
                  backgroundColor: showColorPicker
                    ? "var(--color-background-hover)"
                    : "transparent",
                }}
                title="Color"
              >
                <div
                  className="rounded-sm w-5 h-5"
                  style={{
                    backgroundColor: color,
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                  }}
                />
              </button>

              {/* Color Picker Popup */}
              {showColorPicker && (
                <div
                  className="bottom-full left-1/2 absolute flex gap-1.5 shadow-lg mb-2 p-2 rounded-sm -translate-x-1/2"
                  style={{
                    backgroundColor: "var(--color-background-elevated)",
                    border: "1px solid var(--color-border-default)",
                  }}
                >
                  {colors.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        setColor(c.value);
                        setIsErasing(false);
                        setShowColorPicker(false);
                      }}
                      className="rounded-sm w-6 h-6 hover:scale-110 transition-transform"
                      style={{
                        backgroundColor: c.value,
                        boxShadow:
                          color === c.value
                            ? "0 0 0 2px var(--color-background-elevated), 0 0 0 3px var(--color-text-secondary)"
                            : c.value === "#ffffff"
                              ? "inset 0 0 0 1px var(--color-border-default)"
                              : "inset 0 0 0 1px rgba(0,0,0,0.1)",
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div
              className="mx-2 w-px h-6"
              style={{ backgroundColor: "var(--color-border-muted)" }}
            />

            {/* Brush Sizes */}
            <div className="flex items-center gap-0.5">
              {BRUSH_SIZES.map((size) => (
                <button
                  key={size.value}
                  onClick={() => setBrushSize(size.value)}
                  className="flex justify-center items-center rounded-sm w-8 h-8 transition-colors"
                  style={{
                    backgroundColor:
                      brushSize === size.value
                        ? "var(--color-background-hover)"
                        : "transparent",
                  }}
                  title={size.name}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d="M5 10h10"
                      stroke="var(--color-text-primary)"
                      strokeWidth={
                        size.value === 3 ? 1.25 : size.value === 6 ? 2.5 : 3.75
                      }
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Save Button - matches toolbar: py-1 padding + h-9 inner */}
          <button
            onClick={handleSave}
            className="right-4 bottom-4 absolute flex justify-center items-center gap-1.5 hover:opacity-90 shadow-lg px-3 py-1 rounded-sm font-medium text-sm transition-opacity"
            style={{
              backgroundColor: "var(--color-background-elevated)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <Check className="w-4 h-4" />
            <div className="flex items-center gap-1.5 h-9">Save</div>
          </button>
        </div>
      </div>
    </div>
  );
}
