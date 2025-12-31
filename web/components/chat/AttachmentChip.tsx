"use client";

import { useState } from "react";
import { Loader2, X, FileText, File } from "lucide-react";
import { cn, isImageFile, isPdfFile } from "@/lib/utils";

interface AttachmentChipProps {
  fileName: string;
  mimeType: string;
  status: "pending" | "checking" | "uploading" | "ready" | "error";
  error?: string;
  preview?: string;
  onRemove: () => void;
  isDrawing?: boolean;
  onEdit?: () => void;
}

export function AttachmentChip({
  fileName,
  mimeType,
  status,
  error,
  preview,
  onRemove,
  isDrawing,
  onEdit,
}: AttachmentChipProps) {
  const [showModal, setShowModal] = useState(false);
  const isImage = isImageFile(mimeType);
  const isPdf = isPdfFile(mimeType);
  const hasError = status === "error";
  const isProcessing = status === "uploading" || status === "checking";

  const Icon = isPdf ? FileText : File;

  // Truncate filename for non-images
  const displayName =
    fileName.length > 15
      ? fileName.slice(0, 8) + "..." + fileName.slice(-4)
      : fileName;

  const handleClick = () => {
    if (hasError || isProcessing || !preview) return;

    // For drawings, open the editor instead of the modal
    if (isDrawing && onEdit) {
      onEdit();
      return;
    }

    if (isImage) {
      setShowModal(true);
    } else {
      // Open in new tab for PDFs and other files
      window.open(preview, "_blank");
    }
  };

  // Image attachment - clean thumbnail only
  if (isImage && preview) {
    return (
      <>
        <div
          className={cn(
            "group relative rounded-sm overflow-hidden cursor-pointer",
            "border transition-all hover:border-[var(--color-border-focus)]",
            hasError ? "border-red-300" : "border-[var(--color-border-default)]"
          )}
          onClick={handleClick}
        >
          <img
            src={preview}
            alt={fileName}
            className="w-16 h-16 object-cover"
          />

          {/* Overlay with X on hover */}
          {!isProcessing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className={cn(
                "top-1 right-1 absolute p-1 rounded-full",
                "bg-black/60 text-white opacity-0 group-hover:opacity-100",
                "transition-opacity hover:bg-black/80"
              )}
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Processing spinner overlay */}
          {isProcessing && (
            <div className="absolute inset-0 flex justify-center items-center bg-black/40">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Image modal */}
        {showModal && (
          <div
            className="z-[100] fixed flex flex-col justify-center items-center"
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onClick={() => setShowModal(false)}
          >
            {/* Image container with close button */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowModal(false)}
                className="top-2 -right-8 absolute text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div
                className="rounded-sm overflow-hidden"
                style={{ backgroundColor: "var(--color-background-secondary)" }}
              >
                <img
                  src={preview}
                  alt={fileName}
                  className="object-contain"
                  style={{
                    maxWidth: "min(720px, 85vw)",
                    maxHeight: "min(600px, 80vh)",
                  }}
                />
              </div>
              {/* Filename - below image */}
              <p className="mt-3 text-white/70 text-sm text-center">
                {fileName}
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Non-image attachment - compact chip with icon
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer",
        "border transition-all hover:border-[var(--color-border-focus)]",
        hasError
          ? "border-red-300 bg-red-50"
          : "border-[var(--color-border-default)] bg-[var(--color-background-secondary)]"
      )}
      onClick={handleClick}
    >
      <Icon
        className="flex-shrink-0 w-5 h-5"
        style={{
          color: hasError ? "rgb(239 68 68)" : "var(--color-text-muted)",
        }}
      />

      <span
        className="font-medium text-xs"
        style={{
          color: hasError ? "rgb(239 68 68)" : "var(--color-text-primary)",
        }}
        title={fileName}
      >
        {displayName}
      </span>

      {error && <span className="text-[10px] text-red-500">{error}</span>}

      {isProcessing ? (
        <Loader2
          className="flex-shrink-0 w-4 h-4 animate-spin"
          style={{ color: "var(--color-text-muted)" }}
        />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            "p-1 rounded-full transition-all",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-[var(--color-background-hover)]"
          )}
          style={{ color: "var(--color-text-muted)" }}
          title="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
