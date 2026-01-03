import { useState, useCallback, useEffect, useRef } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import {
  LocalCore,
  getLocalCores,
  clearLocalCores,
  toggleLocalCoreActive,
  createLocalCore,
  updateLocalCore,
  removeLocalCore,
  reorderLocalCores,
  getLocalActivePrompt,
  getLocalActiveCoreNames,
  initializeLocalCores,
  isCoresInitialized,
} from "@/lib/localCores";
import type { Doc, Id } from "convex/_generated/dataModel";

// Unified core type that works for both local and server cores
export interface Core {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  order: number;
}

// Convert server core to unified type
function serverCoreToCore(core: Doc<"cores">): Core {
  return {
    id: core._id,
    name: core.name,
    content: core.content,
    isActive: core.isActive,
    order: core.order,
  };
}

// Convert local core to unified type
function localCoreToCore(core: LocalCore): Core {
  return {
    id: core.id,
    name: core.name,
    content: core.content,
    isActive: core.isActive,
    order: core.order,
  };
}

export function useCores() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  // Server-side data and mutations (only used when authenticated)
  const serverCores = useQuery(api.cores.list, isAuthenticated ? {} : "skip");
  const syncFromLocalMutation = useMutation(api.cores.syncFromLocal);
  const toggleActiveMutation = useMutation(api.cores.toggleActive);
  const createCoreMutation = useMutation(api.cores.create);
  const updateCoreMutation = useMutation(api.cores.update);
  const removeCoreMutation = useMutation(api.cores.remove);
  const reorderCoresMutation = useMutation(api.cores.reorder);

  // Local cores state
  const [localCores, setLocalCoresState] = useState<LocalCore[]>(() =>
    getLocalCores()
  );
  const [isLocalInitialized, setIsLocalInitialized] =
    useState(isCoresInitialized());

  // Initialize local cores from AsyncStorage
  useEffect(() => {
    if (!isLocalInitialized) {
      initializeLocalCores().then((cores) => {
        setLocalCoresState(cores);
        setIsLocalInitialized(true);
      });
    }
  }, [isLocalInitialized]);

  // Track if we've synced local cores on sign-up
  const hasSyncedRef = useRef(false);

  // Sync local cores to server when user signs up (has no server cores)
  useEffect(() => {
    if (!isAuthenticated || authLoading || hasSyncedRef.current) return;
    if (serverCores === undefined) return; // still loading

    // User is authenticated and has no server cores - sync local ones
    if (serverCores.length === 0) {
      hasSyncedRef.current = true;
      const coresToSync = localCores.map((c) => ({
        name: c.name,
        content: c.content,
        isActive: c.isActive,
        order: c.order,
      }));
      syncFromLocalMutation({ cores: coresToSync }).then(() => {
        // Clear local storage after successful sync
        clearLocalCores().then(() => {
          setLocalCoresState(getLocalCores());
        });
      });
    } else {
      // User has existing server cores (login case) - clear local
      hasSyncedRef.current = true;
      clearLocalCores().then(() => {
        setLocalCoresState(getLocalCores());
      });
    }
  }, [
    isAuthenticated,
    authLoading,
    serverCores,
    localCores,
    syncFromLocalMutation,
  ]);

  // Reset sync flag when user logs out
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      hasSyncedRef.current = false;
      // Reinitialize local cores from storage
      initializeLocalCores().then((cores) => {
        setLocalCoresState(cores);
      });
    }
  }, [isAuthenticated, authLoading]);

  // Compute the current cores list
  const localCoresMapped = localCores.map(localCoreToCore);
  const hasServerCores =
    isAuthenticated && serverCores && serverCores.length > 0;
  const cores: Core[] = hasServerCores
    ? serverCores.map(serverCoreToCore)
    : localCoresMapped;

  // Compute active cores count
  const activeCoresCount = cores.filter((c) => c.isActive).length;

  // Get active system prompt
  const getActivePrompt = useCallback((): string => {
    if (isAuthenticated) {
      if (!serverCores) return "";
      const activeCores = serverCores
        .filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order);
      if (activeCores.length === 0) {
        return serverCores[0]?.content || "";
      }
      return activeCores.map((c) => c.content).join("\n\n");
    } else {
      return getLocalActivePrompt();
    }
  }, [isAuthenticated, serverCores]);

  // Get active core names
  const getActiveCoreNames = useCallback((): string[] => {
    if (isAuthenticated) {
      if (!serverCores) return [];
      const activeCores = serverCores
        .filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order);
      if (activeCores.length === 0) {
        return serverCores[0] ? [serverCores[0].name] : [];
      }
      return activeCores.map((c) => c.name);
    } else {
      return getLocalActiveCoreNames();
    }
  }, [isAuthenticated, serverCores]);

  // Toggle core active state
  const toggleActive = useCallback(
    async (coreId: string): Promise<boolean> => {
      if (isAuthenticated) {
        try {
          await toggleActiveMutation({ id: coreId as Id<"cores"> });
          return true;
        } catch {
          return false;
        }
      } else {
        const result = await toggleLocalCoreActive(coreId);
        if (result) {
          setLocalCoresState(result);
          return true;
        }
        return false;
      }
    },
    [isAuthenticated, toggleActiveMutation]
  );

  // Create a new core
  const createCore = useCallback(
    async (name: string, content: string): Promise<boolean> => {
      if (isAuthenticated) {
        try {
          await createCoreMutation({ name, content });
          return true;
        } catch {
          return false;
        }
      } else {
        const result = await createLocalCore(name, content);
        setLocalCoresState(result);
        return true;
      }
    },
    [isAuthenticated, createCoreMutation]
  );

  // Update a core
  const updateCore = useCallback(
    async (
      coreId: string,
      updates: { name?: string; content?: string }
    ): Promise<boolean> => {
      if (isAuthenticated) {
        try {
          await updateCoreMutation({ id: coreId as Id<"cores">, ...updates });
          return true;
        } catch {
          return false;
        }
      } else {
        const result = await updateLocalCore(coreId, updates);
        setLocalCoresState(result);
        return true;
      }
    },
    [isAuthenticated, updateCoreMutation]
  );

  // Remove a core
  const removeCore = useCallback(
    async (coreId: string): Promise<boolean> => {
      if (isAuthenticated) {
        try {
          await removeCoreMutation({ id: coreId as Id<"cores"> });
          return true;
        } catch {
          return false;
        }
      } else {
        const result = await removeLocalCore(coreId);
        if (result) {
          setLocalCoresState(result);
          return true;
        }
        return false;
      }
    },
    [isAuthenticated, removeCoreMutation]
  );

  // Reorder cores
  const reorderCores = useCallback(
    async (orderedIds: string[]): Promise<boolean> => {
      if (isAuthenticated) {
        try {
          await reorderCoresMutation({
            orderedIds: orderedIds as Id<"cores">[],
          });
          return true;
        } catch {
          return false;
        }
      } else {
        const result = await reorderLocalCores(orderedIds);
        setLocalCoresState(result);
        return true;
      }
    },
    [isAuthenticated, reorderCoresMutation]
  );

  // Set specific cores as active by their IDs
  const setActiveCoresByIds = useCallback(
    async (activeIds: Set<string>): Promise<void> => {
      if (isAuthenticated && serverCores) {
        for (const core of serverCores) {
          const shouldBeActive = activeIds.has(core._id);
          if (shouldBeActive !== core.isActive) {
            await toggleActive(core._id);
          }
        }
      } else {
        for (const core of localCores) {
          const shouldBeActive = activeIds.has(core.id);
          if (shouldBeActive !== core.isActive) {
            await toggleActive(core.id);
          }
        }
      }
    },
    [isAuthenticated, serverCores, localCores, toggleActive]
  );

  return {
    cores,
    activeCoresCount,
    isLoading:
      authLoading ||
      !isLocalInitialized ||
      (isAuthenticated && serverCores === undefined),
    isAuthenticated,
    getActivePrompt,
    getActiveCoreNames,
    toggleActive,
    createCore,
    updateCore,
    removeCore,
    reorderCores,
    setActiveCoresByIds,
  };
}
