"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Plus, Upload, Camera, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachmentMenuProps {
  onUploadFile: () => void;
  onTakeScreenshot: () => void;
  onCreateDrawing: () => void;
}

export function AttachmentMenu({
  onUploadFile,
  onTakeScreenshot,
  onCreateDrawing,
}: AttachmentMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<"above" | "below">("below");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const toggleMenu = useCallback(() => {
    if (!showMenu && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 140;
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      setMenuPosition(spaceBelow >= menuHeight + 16 ? "below" : "above");
    }
    setShowMenu(!showMenu);
  }, [showMenu]);

  const handleUpload = useCallback(() => {
    setShowMenu(false);
    onUploadFile();
  }, [onUploadFile]);

  const handleScreenshot = useCallback(() => {
    setShowMenu(false);
    onTakeScreenshot();
  }, [onTakeScreenshot]);

  const handleDrawing = useCallback(() => {
    setShowMenu(false);
    onCreateDrawing();
  }, [onCreateDrawing]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
        style={{ color: "var(--color-text-secondary)" }}
        title={showMenu ? "Close menu" : "Add content"}
      >
        <Plus
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            showMenu && "rotate-45"
          )}
        />
      </button>

      {showMenu && (
        <div
          className={cn(
            "left-0 z-[39] absolute rounded-sm w-48 overflow-hidden animate-in duration-150 fade-in",
            menuPosition === "below"
              ? "top-full mt-2 slide-in-from-top-2"
              : "bottom-full mb-2 slide-in-from-bottom-2"
          )}
          style={{
            backgroundColor: "var(--color-background-elevated)",
            border: "1px solid var(--color-border-default)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          <button
            onClick={handleUpload}
            className="flex items-center gap-3 hover:bg-[var(--color-background-hover)] px-3 py-2 w-full text-left transition-colors"
            style={{ color: "var(--color-text-primary)" }}
          >
            <Upload
              className="w-4 h-4"
              style={{ color: "var(--color-text-secondary)" }}
            />
            <span className="text-sm">Upload a file</span>
          </button>
          <button
            onClick={handleScreenshot}
            className="flex items-center gap-3 hover:bg-[var(--color-background-hover)] px-3 py-2 w-full text-left transition-colors"
            style={{ color: "var(--color-text-primary)" }}
          >
            <Camera
              className="w-4 h-4"
              style={{ color: "var(--color-text-secondary)" }}
            />
            <span className="text-sm">Take a screenshot</span>
          </button>
          <button
            onClick={handleDrawing}
            className="flex items-center gap-3 hover:bg-[var(--color-background-hover)] px-3 py-2 w-full text-left transition-colors"
            style={{ color: "var(--color-text-primary)" }}
          >
            <PenTool
              className="w-4 h-4"
              style={{ color: "var(--color-text-secondary)" }}
            />
            <span className="text-sm">Create drawing</span>
          </button>
        </div>
      )}
    </div>
  );
}
