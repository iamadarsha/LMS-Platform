import { useAuth } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Gate a route behind a Clerk session. Redirects to /signin while preserving
 * the original destination in the `redirect` query param. Renders children
 * once Clerk has hydrated and confirmed a signed-in user.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/signin?redirect=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}
