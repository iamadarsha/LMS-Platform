import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const categories = [
  "All",
  "AI & Automation",
  "Workflows",
  "Design Systems",
  "Commerce",
  "Knowledge",
  "Data & Analytics",
  "Prompt Engineering",
  "Growth",
  "Engineering",
];

export function CategoryTabs() {
  const [active, setActive] = useState("All");

  return (
    <div className="flex items-center gap-3">
      <button
        aria-label="Scroll left"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="flex flex-1 gap-2 overflow-x-auto no-scrollbar">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              active === c
                ? "bg-gradient-primary text-primary-foreground shadow-violet"
                : "border border-border bg-card/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <button
        aria-label="Scroll right"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground transition hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}