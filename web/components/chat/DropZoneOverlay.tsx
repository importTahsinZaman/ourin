"use client";

import { Upload } from "lucide-react";

interface DropZoneOverlayProps {
  isVisible: boolean;
}

export function DropZoneOverlay({ isVisible }: DropZoneOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className="z-50 absolute inset-0 flex justify-center items-center pointer-events-none"
      style={{
        backgroundColor: "var(--color-background-primary)",
        opacity: 0.95,
      }}
    >
      <div
        className="flex flex-col items-center gap-4 m-6 p-8 border-2 border-dashed rounded-xl"
        style={{
          borderColor: "var(--color-accent-primary)",
          backgroundColor: "var(--color-accent-primary-muted)",
        }}
      >
        <Upload
          className="w-12 h-12"
          style={{ color: "var(--color-accent-primary)" }}
        />
        <div className="text-center">
          <p
            className="font-medium text-lg"
            style={{ color: "var(--color-text-primary)" }}
          >
            Drop files to attach
          </p>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Images, documents, and more
          </p>
        </div>
      </div>
    </div>
  );
}
