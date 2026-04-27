import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";

export function StudioHeader() {
  const navigate = useNavigate();
  const { user } = useUser();
  const initial =
    user?.firstName?.[0]?.toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    "D";

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl">
      <button
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Exit Studio
      </button>

      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-primary">//</span>
        <span className="text-lg font-bold tracking-tight text-foreground">hyvmind</span>
        <span className="text-sm font-medium text-muted-foreground">studio</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <SignedIn>
          <UserButton
            afterSignOutUrl="/signin"
            appearance={{
              elements: {
                userButtonAvatarBox:
                  "h-10 w-10 rounded-full bg-gradient-primary text-primary-foreground shadow-violet",
                userButtonAvatarImage: "h-10 w-10 rounded-full",
              },
            }}
          />
        </SignedIn>
        <SignedOut>
          <button
            aria-label="Sign in"
            onClick={() => navigate("/signin")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-violet"
          >
            {initial}
          </button>
        </SignedOut>
      </div>
    </header>
  );
}
