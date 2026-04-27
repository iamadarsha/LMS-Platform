import { Search, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";

export function DashboardHeader() {
  const navigate = useNavigate();
  const { user } = useUser();
  const initial =
    user?.firstName?.[0]?.toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    "H";

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-6 border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl">
      <div className="flex w-64 shrink-0 items-center gap-2">
        <span className="font-mono text-sm text-primary">//</span>
        <span className="text-lg font-bold tracking-tight text-foreground">Hyvemind</span>
      </div>

      <div className="relative mx-auto flex w-full max-w-2xl items-center">
        <Search className="absolute left-4 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search resources, tutorials, experts..."
          className="h-11 w-full rounded-full border border-border bg-card/80 pl-11 pr-14 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <button
          aria-label="Search"
          className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
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
            type="button"
            aria-label="Sign in"
            onClick={() => navigate("/signin")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {initial}
          </button>
        </SignedOut>
      </div>
    </header>
  );
}
