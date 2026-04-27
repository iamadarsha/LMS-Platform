import { Play, BookOpen, ArrowUpRight, Eye, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getSignedAssetUrl } from "@/data/contributionsStore";
import { useFavouriteCounts } from "@/data/favouritesStore";

export type MediaItem = {
  type: string;
  icon?: "video" | "tutorial";
  title: string;
  author: string;
  duration: string;
  progress: number; // 0..100
  badge?: string;
  glow?: "cyan" | "pink" | "violet";
  views?: number;
  likes?: number;
  thumbnail?: string;
};

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n}`;
}

export function MediaCard({ item }: { item: MediaItem }) {
  const Icon = item.icon === "tutorial" ? BookOpen : Play;
  const glow = item.glow ?? "violet";
  const views = item.views ?? 1240;
  const likes = item.likes ?? 86;
  return (
    <article
      className={cn(
        "group neon-border card-lift flex h-full flex-col overflow-hidden",
        glow === "cyan" && "neon-cyan",
        glow === "pink" && "neon-pink",
        glow === "violet" && "neon-violet",
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(0_0%_100%/0.06),transparent_70%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-foreground/15 bg-background/40 backdrop-blur-md transition group-hover:scale-110 group-hover:border-foreground/40">
            <Icon className="h-6 w-6 text-foreground" fill={item.icon === "tutorial" ? "none" : "currentColor"} />
          </div>
        </div>
        <span className="absolute bottom-3 right-3 rounded-md border border-foreground/10 bg-background/70 px-2 py-1 text-xs font-medium text-foreground backdrop-blur">
          {item.duration}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border/40">
          <div className="h-full bg-gradient-neon" style={{ width: `${item.progress}%` }} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-foreground/15 bg-background/60 px-2 py-0.5 font-mono font-semibold uppercase tracking-[0.18em] text-foreground/80">
              {item.type}
            </span>
            <span className="text-muted-foreground">{item.progress}% complete</span>
          </div>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            {formatCount(views)}
          </span>
        </div>
        <h3 className="line-clamp-2 min-h-[3.25rem] text-lg font-bold leading-snug tracking-tight text-foreground">
          {item.title}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{item.author}</p>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Heart className="h-3.5 w-3.5" />
            {formatCount(likes)}
          </span>
        </div>
      </div>
    </article>
  );
}

export type ResourceItem = {
  id?: string;
  category: string;
  title: string;
  author: string;
  duration: string;
  progress?: number;
  description?: string;
  glow?: "cyan" | "pink" | "violet";
  views?: number;
  likes?: number;
  thumbnail?: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "H";
}

function useResolvedAsset(src?: string) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!src) {
        setResolvedSrc(undefined);
        return;
      }
      const url = await getSignedAssetUrl(src);
      if (!cancelled) setResolvedSrc(url);
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return resolvedSrc;
}

export function ResourceCard({ item }: { item: ResourceItem }) {
  const favouriteCounts = useFavouriteCounts();
  const views = item.views ?? 980;
  const likes = item.id ? (favouriteCounts.get(item.id) ?? 0) : (item.likes ?? 0);
  const progress = Math.min(100, Math.max(0, item.progress ?? 0));
  const description = item.description?.trim() || "No description provided yet.";
  const thumbnail = useResolvedAsset(item.thumbnail);
  return (
    <article className="group neon-border neon-violet card-lift flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/9] overflow-hidden bg-muted/30">
        {thumbnail && (
          <img
            src={thumbnail}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="absolute right-5 top-5 rounded-xl border border-primary/50 bg-card/90 px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary backdrop-blur">
          {item.category}
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-foreground/15 bg-background/40 backdrop-blur-md opacity-0 transition group-hover:scale-110 group-hover:border-foreground/40 group-hover:opacity-100">
            <Play className="h-6 w-6 text-foreground" fill="currentColor" />
          </div>
        </div>
      </div>
      <div className="h-1 bg-muted" aria-label={`${progress}% watched`}>
        <div className="h-full rounded-r-full bg-gradient-cyan" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex flex-1 flex-col gap-4 px-7 py-6">
        <h3 className="line-clamp-2 font-bold leading-tight tracking-tight text-foreground text-2xl">
          {item.title}
        </h3>
        <p className="line-clamp-2 min-h-[3.5rem] leading-relaxed text-muted-foreground text-base">
          {description}
        </p>
        <div className="mt-auto flex items-center justify-between gap-4 pt-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10 border border-primary/40">
              <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
                {initials(item.author)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-base font-medium text-foreground">{item.author}</span>
          </div>
          <div className="flex shrink-0 items-center gap-5 text-base text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-5 w-5" />
              {formatCount(views)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Heart className="h-5 w-5" />
              {formatCount(likes)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SectionHeader({
  title,
  subtitle,
  seeAllTo,
}: {
  title: string;
  subtitle: string;
  seeAllTo?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <h2 className="text-3xl tracking-tight text-foreground font-extrabold md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {seeAllTo && (
        <Link
          to={seeAllTo}
          className="group flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          See all
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}
    </div>
  );
}