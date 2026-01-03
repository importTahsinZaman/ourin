import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { ReactNode } from "react";

// validate convex url
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "EXPO_PUBLIC_CONVEX_URL is required. Check your .env.local file."
  );
}

// convex client instance
const convex = new ConvexReactClient(convexUrl);

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
