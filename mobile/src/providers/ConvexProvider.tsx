import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { ReactNode } from "react";

// convex client instance
const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string
);

interface ConvexProviderProps {
  children: ReactNode;
}

export function ConvexProvider({ children }: ConvexProviderProps) {
  // for now, use the basic provider without auth
  // todo: integrate with @convex-dev/auth for react native
  return (
    <ConvexProviderWithAuth
      client={convex}
      useAuth={() => ({ isLoading: false, isAuthenticated: false })}
    >
      {children}
    </ConvexProviderWithAuth>
  );
}
