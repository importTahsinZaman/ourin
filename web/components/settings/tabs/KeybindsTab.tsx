"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { SettingsSection, SettingsDivider } from "../SettingsModal";
import {
  KeybindAction,
  KeybindConfig,
  KeybindsMap,
  KEYBIND_LABELS,
  DEFAULT_KEYBINDS,
  formatKeybind,
  eventToKeybindConfig,
  keybindsEqual,
  isReservedShortcut,
  parseKeybinds,
  serializeKeybinds,
  KEYBINDS_STORAGE_KEY,
} from "@/lib/keybinds";

// Group keybinds by category for better organization
const KEYBIND_GROUPS: { label: string; actions: KeybindAction[] }[] = [
  {
    label: "Navigation",
    actions: ["toggleSidebarLeft", "toggleSidebarRight"],
  },
  {
    label: "Actions",
    actions: ["newChat", "commandPalette"],
  },
  {
    label: "Panels",
    actions: ["settings", "appearance"],
  },
];

// Flat list for iteration
const KEYBIND_ACTIONS: KeybindAction[] = KEYBIND_GROUPS.flatMap(
  (group) => group.actions
);

export function KeybindsTab() {
  const { isAuthenticated } = useConvexAuth();

  // DB queries/mutations for authenticated users
  const savedKeybinds = useQuery(
    api.settings.getKeybinds,
    isAuthenticated ? {} : "skip"
  );
  const updateKeybindsMutation = useMutation(api.settings.updateKeybinds);

  // Local state
  const [keybinds, setKeybinds] = useState<KeybindsMap>({
    ...DEFAULT_KEYBINDS,
  });
  const [editingAction, setEditingAction] = useState<KeybindAction | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [sidebarSide, setSidebarSide] = useState<"left" | "right">("left");

  // Detect Mac vs Windows and read sidebar side from cookie
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);

    // Read sidebar side from cookie
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "ourin-sidebar-side") {
        setSidebarSide(value === "right" ? "right" : "left");
        break;
      }
    }
  }, []);

  // Check if a keybind action is currently active based on sidebar position
  const isActiveAction = (action: KeybindAction): boolean => {
    if (sidebarSide === "left") {
      return action === "toggleSidebarLeft";
    } else {
      return action === "toggleSidebarRight";
    }
  };

  // Load keybinds from DB or localStorage
  useEffect(() => {
    if (isAuthenticated) {
      // Authenticated: use DB
      if (savedKeybinds !== undefined) {
        setKeybinds(parseKeybinds(savedKeybinds));
      }
    } else {
      // Anonymous: use localStorage
      const stored = localStorage.getItem(KEYBINDS_STORAGE_KEY);
      setKeybinds(parseKeybinds(stored));
    }
  }, [isAuthenticated, savedKeybinds]);

  // Save keybinds
  const saveKeybinds = useCallback(
    async (newKeybinds: KeybindsMap) => {
      setIsSaving(true);
      const serialized = serializeKeybinds(newKeybinds);

      try {
        if (isAuthenticated) {
          await updateKeybindsMutation({ keybinds: serialized });
        } else {
          localStorage.setItem(KEYBINDS_STORAGE_KEY, serialized);
        }
        setKeybinds(newKeybinds);
      } catch {
        toast.error("Failed to save keybinds");
      } finally {
        setIsSaving(false);
      }
    },
    [isAuthenticated, updateKeybindsMutation]
  );

  // Check for conflicts
  const findConflict = useCallback(
    (action: KeybindAction, config: KeybindConfig): KeybindAction | null => {
      for (const [otherAction, otherConfig] of Object.entries(keybinds)) {
        if (otherAction !== action && keybindsEqual(config, otherConfig)) {
          return otherAction as KeybindAction;
        }
      }
      return null;
    },
    [keybinds]
  );

  // Handle key capture
  useEffect(() => {
    if (!editingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels editing
      if (e.key === "Escape") {
        setEditingAction(null);
        return;
      }

      // Ignore modifier-only presses
      if (["Meta", "Control", "Shift", "Alt"].includes(e.key)) {
        return;
      }

      const config = eventToKeybindConfig(e);

      // Check for reserved shortcuts
      if (isReservedShortcut(config)) {
        toast.error("Reserved shortcut", {
          description: "This shortcut is reserved by the system.",
        });
        return;
      }

      // Check for conflicts
      const conflict = findConflict(editingAction, config);
      if (conflict) {
        toast.error("Conflict detected", {
          description: `This shortcut is already used by "${KEYBIND_LABELS[conflict]}".`,
        });
        return;
      }

      // Save the new keybind
      const newKeybinds = { ...keybinds, [editingAction]: config };
      saveKeybinds(newKeybinds);
      setEditingAction(null);
      toast.success("Keybind updated");
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editingAction, keybinds, findConflict, saveKeybinds]);

  // Reset single keybind
  const handleReset = async (action: KeybindAction) => {
    const newKeybinds = { ...keybinds, [action]: DEFAULT_KEYBINDS[action] };
    await saveKeybinds(newKeybinds);
    toast.success("Keybind reset to default");
  };

  // Reset all keybinds
  const handleResetAll = async () => {
    await saveKeybinds({ ...DEFAULT_KEYBINDS });
    toast.success("All keybinds reset to defaults");
  };

  // Check if a keybind differs from default
  const isModified = (action: KeybindAction) => {
    return !keybindsEqual(keybinds[action], DEFAULT_KEYBINDS[action]);
  };

  // Check if any keybinds are modified
  const hasModifications = KEYBIND_ACTIONS.some(isModified);

  return (
    <div className="space-y-6">
      {/* Keybinds list - grouped */}
      {KEYBIND_GROUPS.map((group, index) => (
        <div key={group.label}>
          {index > 0 && <SettingsDivider />}
          <SettingsSection title={group.label}>
            <div className="space-y-1">
              {group.actions.map((action) => (
                <div
                  key={action}
                  className="flex justify-between items-center px-3 py-2 rounded-sm"
                  style={{
                    backgroundColor:
                      editingAction === action
                        ? "var(--color-accent-primary-muted)"
                        : "var(--color-background-tertiary)",
                  }}
                >
                  {/* Label */}
                  <span className="flex items-center gap-2">
                    <span
                      className="font-medium text-sm"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {KEYBIND_LABELS[action]}
                    </span>
                    {isActiveAction(action) && (
                      <span
                        className="px-1.5 py-0.5 rounded font-medium text-[10px] uppercase tracking-wide"
                        style={{
                          backgroundColor: "var(--color-accent-primary-muted)",
                          color: "var(--color-accent-primary)",
                        }}
                      >
                        Active
                      </span>
                    )}
                  </span>

                  {/* Keybind display / edit */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingAction(action)}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-sm min-w-[80px] font-mono text-sm text-center transition-colors"
                      style={{
                        backgroundColor:
                          editingAction === action
                            ? "var(--color-accent-primary)"
                            : "var(--color-background-secondary)",
                        color:
                          editingAction === action
                            ? "var(--color-text-inverse)"
                            : "var(--color-text-primary)",
                        border: "1px solid var(--color-border-default)",
                      }}
                    >
                      {editingAction === action ? (
                        <span className="animate-pulse">Press key...</span>
                      ) : (
                        formatKeybind(keybinds[action], isMac)
                      )}
                    </button>

                    {/* Reset button (only show if modified) */}
                    {isModified(action) && (
                      <button
                        onClick={() => handleReset(action)}
                        disabled={isSaving}
                        className="hover:bg-[var(--color-background-hover)] p-1.5 rounded-sm transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                        title="Reset to default"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>
        </div>
      ))}

      <SettingsDivider />

      {/* Reset all button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleResetAll}
          disabled={isSaving || !hasModifications}
          className="flex items-center gap-2 disabled:opacity-50 px-3 py-1.5 rounded-sm font-medium text-sm transition-colors"
          style={{
            backgroundColor: "var(--color-background-tertiary)",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          Reset All to Defaults
        </button>
      </div>
    </div>
  );
}
