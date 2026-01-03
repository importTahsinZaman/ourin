import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

/**
 * Hook for checking authentication state.
 *
 * Provides:
 * - isAuthenticated: Whether the user is logged in
 * - isLoading: Whether auth state is still being determined
 * - user: The current user object (if authenticated)
 */
export function useAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(
    api.settings.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  return {
    isAuthenticated,
    isLoading,
    user: user ?? null,
  };
}
