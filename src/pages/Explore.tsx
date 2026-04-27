import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { PageShell } from "@/components/dashboard/PageShell";
import { ResourceCard, type ResourceItem } from "@/components/dashboard/MediaCard";
import { contentLibrary, slugify, type ContentEntry } from "@/data/content";
import { useContributions } from "@/data/contributionsStore";
import { EmptyLibraryState } from "@/components/EmptyLibraryState";
import { cn } from "@/lib/utils";

const ALL = "All";
const SS_KEY = "hyvemind:explore:selected-category";

const toResource = (c: ContentEntry): ResourceItem => ({
  id: c.id,
  category: c.type,
  title: c.title,
  author: c.author,
  duration: c.duration,
  description: c.description ?? c.summary,
  glow: c.glow,
  views: c.views,
  likes: c.likes,
  thumbnail: c.thumbnail,
});

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

const Explore = () => {
  const { items: contributions } = useContributions();
  const library = useMemo(() => [...contributions, ...contentLibrary], [contributions]);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 200);

  const initialCategory =
    typeof window !== "undefined" ? window.sessionStorage.getItem(SS_KEY) || ALL : ALL;
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);

  useEffect(() => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(SS_KEY, selectedCategory);
  }, [selectedCategory]);

  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(library.map((c) => c.type)))],
    [library],
  );

  // Make sure the persisted category is still valid as the library changes.
  useEffect(() => {
    if (selectedCategory !== ALL && !categories.includes(selectedCategory)) {
      setSelectedCategory(ALL);
    }
  }, [categories, selectedCategory]);

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return library.filter((c) => {
      const inCategory = selectedCategory === ALL || c.type === selectedCategory;
      if (!inCategory) return false;
      if (!needle) return true;
      const haystack = [
        c.title,
        c.author,
        c.type,
        c.description ?? "",
        c.summary ?? "",
        ...(c.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [library, selectedCategory, debouncedQuery]);

  return (
    <PageShell
      eyebrow="EXPLORE // ALL_CONTENT"
      title="Explore the library"
      description="Browse every tutorial, video and workflow across the Hyvemind knowledge base."
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across topics, authors and tags…"
            className="w-full rounded-full border border-border bg-card/60 py-3 pl-11 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const active = selectedCategory === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(c)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "bg-gradient-primary text-primary-foreground shadow-violet"
                  : "border border-border bg-card/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>

      {library.length === 0 ? (
        <EmptyLibraryState />
      ) : filtered.length === 0 ? (
        <div className="neon-border neon-subtle space-y-3 rounded-2xl p-10 text-center">
          <p className="text-sm font-semibold text-foreground">
            No matches{debouncedQuery ? ` for “${debouncedQuery}”` : ""}
            {selectedCategory !== ALL ? ` in ${selectedCategory}` : ""}.
          </p>
          <p className="text-xs text-muted-foreground">
            Try a different search or change the category.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedCategory(ALL);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        </div>
      ) : (
        <section className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <Link key={entry.id ?? entry.title} to={`/content/${slugify(entry.title)}`} className="block h-full">
              <ResourceCard item={toResource(entry)} />
            </Link>
          ))}
        </section>
      )}
    </PageShell>
  );
};

export default Explore;
