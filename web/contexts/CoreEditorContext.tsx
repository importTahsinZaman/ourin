"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import type { Core } from "@/hooks/useCores";

const POSITION_STORAGE_KEY = "ourin-core-editor-position";

interface Position {
  x: number;
  y: number;
}

interface CoreEditorContextValue {
  isOpen: boolean;
  editingCore: Core | null;
  position: Position;
  openEditor: (core?: Core | null) => void;
  closeEditor: () => void;
  setPosition: (pos: Position) => void;
}

const CoreEditorContext = createContext<CoreEditorContextValue | null>(null);

function getStoredPosition(): Position | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore
  }
  return null;
}

function storePosition(pos: Position): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // Ignore
  }
}

export function CoreEditorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCore, setEditingCore] = useState<Core | null>(null);
  const [position, setPositionState] = useState<Position>({ x: -1, y: -1 });

  // Load stored position on mount
  useEffect(() => {
    const stored = getStoredPosition();
    if (stored) {
      setPositionState(stored);
    }
  }, []);

  const openEditor = useCallback((core?: Core | null) => {
    setEditingCore(core ?? null);
    setIsOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsOpen(false);
    setEditingCore(null);
  }, []);

  const setPosition = useCallback((pos: Position) => {
    setPositionState(pos);
    storePosition(pos);
  }, []);

  return (
    <CoreEditorContext.Provider
      value={{
        isOpen,
        editingCore,
        position,
        openEditor,
        closeEditor,
        setPosition,
      }}
    >
      {children}
    </CoreEditorContext.Provider>
  );
}

export function useCoreEditor(): CoreEditorContextValue {
  const context = useContext(CoreEditorContext);
  if (!context) {
    throw new Error("useCoreEditor must be used within a CoreEditorProvider");
  }
  return context;
}
