import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SignIn as ClerkSignIn, SignUp as ClerkSignUp, useAuth } from "@clerk/clerk-react";
import { useState } from "react";

/**
 * Sign-in / sign-up screen powered by Clerk. Embeds Clerk's prebuilt
 * components inside the existing dark Hyvemind shell so the visual
 * language stays consistent across the app.
 */
export default function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "/studio/contribute";
  const { isLoaded, isSignedIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate(redirectTo, { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate, redirectTo]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-2">
          <p className="font-mono text-xs tracking-[0.3em] text-primary">// HYVMIND</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Sign in to continue"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signup"
              ? "Join your team's knowledge hive."
              : "Pick up where you left off."}
          </p>
        </header>

        <div className="flex justify-center">
          {mode === "signin" ? (
            <ClerkSignIn
              routing="hash"
              signUpUrl="#"
              afterSignInUrl={redirectTo}
              afterSignUpUrl={redirectTo}
            />
          ) : (
            <ClerkSignUp
              routing="hash"
              signInUrl="#"
              afterSignInUrl={redirectTo}
              afterSignUpUrl={redirectTo}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="block w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "No account yet? Create one"}
        </button>
      </div>
    </div>
  );
}
