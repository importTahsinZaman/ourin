// local storage utilities for cores (used when not logged in)

import { DEFAULT_CORES as DEFAULT_CORE_DATA } from "@/convex/defaultCores";
import { setCookie } from "@/lib/cookies";

const LOCAL_CORES_KEY = "ourin-local-cores";

export interface LocalCore {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

// build local cores from shared defaults
const DEFAULT_CORES: LocalCore[] = DEFAULT_CORE_DATA.map((core) => ({
  id: `default-${core.name.toLowerCase().replace(/\s+/g, "-")}`,
  name: core.name,
  content: core.content,
  isActive: core.isActive,
  order: core.order,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}));

// read cores from localStorage synchronously (for sSR-safe initialization)
export function getLocalCores(): LocalCore[] {
  if (typeof window === "undefined") {
    return DEFAULT_CORES;
  }

  try {
    const stored = localStorage.getItem(LOCAL_CORES_KEY);
    if (!stored) {
      // initialize with defaults
      localStorage.setItem(LOCAL_CORES_KEY, JSON.stringify(DEFAULT_CORES));
      return DEFAULT_CORES;
    }
    return JSON.parse(stored);
  } catch {
    return DEFAULT_CORES;
  }
}

// save cores to localStorage
export function setLocalCores(cores: LocalCore[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_CORES_KEY, JSON.stringify(cores));
  } catch {
    // ignore storage errors
  }
}

// clear local cores (called on login when user has existing server cores)
export function clearLocalCores(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_CORES_KEY);
  } catch {
    // ignore storage errors
  }
}

// check if local cores exist and have been modified from defaults
export function hasLocalCores(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LOCAL_CORES_KEY) !== null;
  } catch {
    return false;
  }
}

// get active cores' system prompt (concatenated)
export function getLocalActivePrompt(): string {
  const cores = getLocalCores();
  const activeCores = cores
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);

  if (activeCores.length === 0) {
    return cores[0]?.content || "";
  }

  return activeCores.map((c) => c.content).join("\n\n");
}

// get active cores' names
export function getLocalActiveCoreNames(): string[] {
  const cores = getLocalCores();
  const activeCores = cores
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);

  if (activeCores.length === 0) {
    return cores[0] ? [cores[0].name] : [];
  }

  return activeCores.map((c) => c.name);
}

// toggle a core's active state
export function toggleLocalCoreActive(coreId: string): LocalCore[] | null {
  const cores = getLocalCores();
  const core = cores.find((c) => c.id === coreId);
  if (!core) return null;

  // if trying to deactivate, check if it's the only active one
  if (core.isActive) {
    const activeCores = cores.filter((c) => c.isActive);
    if (activeCores.length <= 1) {
      return null; // can't deactivate the last active core
    }
  }

  const updatedCores = cores.map((c) =>
    c.id === coreId ? { ...c, isActive: !c.isActive, updatedAt: Date.now() } : c
  );
  setLocalCores(updatedCores);
  return updatedCores;
}

// create a new core
export function createLocalCore(name: string, content: string): LocalCore[] {
  const cores = getLocalCores();
  const maxOrder =
    cores.length > 0 ? Math.max(...cores.map((c) => c.order)) : -1;
  const now = Date.now();

  const newCore: LocalCore = {
    id: `local-${now}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    content,
    isActive: false,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };

  const updatedCores = [...cores, newCore];
  setLocalCores(updatedCores);
  return updatedCores;
}

// update an existing core
export function updateLocalCore(
  coreId: string,
  updates: { name?: string; content?: string }
): LocalCore[] {
  const cores = getLocalCores();
  const updatedCores = cores.map((c) =>
    c.id === coreId ? { ...c, ...updates, updatedAt: Date.now() } : c
  );
  setLocalCores(updatedCores);
  return updatedCores;
}

// remove a core
export function removeLocalCore(coreId: string): LocalCore[] | null {
  const cores = getLocalCores();

  // can't delete the only core
  if (cores.length <= 1) {
    return null;
  }

  const coreToRemove = cores.find((c) => c.id === coreId);
  if (!coreToRemove) return cores;

  let updatedCores = cores.filter((c) => c.id !== coreId);

  // if we removed an active core and it was the only active one, activate another
  if (coreToRemove.isActive) {
    const hasActive = updatedCores.some((c) => c.isActive);
    if (!hasActive && updatedCores.length > 0) {
      updatedCores = updatedCores.map((c, i) =>
        i === 0 ? { ...c, isActive: true, updatedAt: Date.now() } : c
      );
    }
  }

  setLocalCores(updatedCores);
  return updatedCores;
}

// reorder cores
export function reorderLocalCores(orderedIds: string[]): LocalCore[] {
  const cores = getLocalCores();
  const updatedCores = cores.map((core) => {
    const newOrder = orderedIds.indexOf(core.id);
    if (newOrder !== -1 && newOrder !== core.order) {
      return { ...core, order: newOrder, updatedAt: Date.now() };
    }
    return core;
  });
  updatedCores.sort((a, b) => a.order - b.order);
  setLocalCores(updatedCores);
  return updatedCores;
}

// cookie name for active cores count (readable server-side)
const ACTIVE_CORES_COUNT_COOKIE = "ourin-active-cores-count";

// set active cores count in cookie (for sSR)
export function setCachedActiveCoresCount(count: number): void {
  setCookie(ACTIVE_CORES_COUNT_COOKIE, String(count));
}
