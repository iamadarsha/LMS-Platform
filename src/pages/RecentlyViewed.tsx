import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, Clock, Eye, Heart, Play } from "lucide-react";
import { PageShell } from "@/components/dashboard/PageShell";
import { ResourceCard, type ResourceItem } from "@/components/dashboard/MediaCard";
import { contentLibrary, slugify, type ContentEntry } from "@/data/content";
import { useContributions } from "@/data/contributionsStore";
import { useWatchProgress, type WatchProgressEntry } from "@/data/watchProgressStore";
import { EmptyLibraryState } from "@/components/EmptyLibraryState";

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n}`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day} days ago`;
  if (day < 30) return `${Math.floor(day / 7)} wk ago`;
  if (day < 365) return `${Math.floor(day / 30)} mo ago`;
  return `${Math.floor(day / 365)} yr ago`;
}

const toResource = (c: ContentEntry): ResourceItem => ({
  id: c.id,
  category: c.type,
  title: c.title,
  author: c.author,
  duration: c.duration,
  progress: c.progress,
  description: c.description ?? c.summary,
  glow: c.glow,
  views: c.views,
  likes: c.likes,
  thumbnail: c.thumbnail,
});

const RecentlyViewed = () => {
  const { items: contributions } = useContributions();
  const watchProgress = useWatchProgress();
  const location = useLocation();
  const continueRef = useRef<HTMLElement | null>(null);
  const historyRef = useRef<HTMLElement | null>(null);

  const library = [...contributions, ...contentLibrary];

  type Enriched = { entry: ContentEntry; wp: WatchProgressEntry };
  const watched: Enriched[] = library
    .filter((c): c is ContentEntry & { id: string } => Boolean(c.id))
    .map((c) => ({ entry: c, wp: watchProgress.get(c.id!)! }))
    .filter((x) => Boolean(x.wp))
    .sort(
      (a, b) =>
        new Date(b.wp.lastWatchedAt).getTime() - new Date(a.wp.lastWatchedAt).getTime(),
    );

  const continueWatching = watched.filter((x) => !x.wp.completed);

  useEffect(() => {
    if (location.hash === "#continue-watching" && continueRef.current) {
      continueRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (location.hash === "#watch-history" && historyRef.current) {
      historyRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, watched.length]);

  return (
    <PageShell
      eyebrow="YOU // HISTORY"
      title="Recently viewed"
      description="Pick up exactly where you left off, and revisit everything you've ever opened."
    >
      <div className="space-y-16">
        <section ref={continueRef} id="continue-watching" className="scroll-mt-28">
          <div className="mb-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Continue Watching</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every video you've started but haven't finished yet.
            </p>
          </div>
          {continueWatching.length === 0 ? (
            <EmptyLibraryState
              title="Nothing in progress"
              description="Start a video and it'll show up here so you can pick up where you left off."
              ctaLabel="Explore Resources"
              ctaTo="/explore"
            />
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
              {continueWatching.map(({ entry, wp }) => (
                <Link
                  key={`cw-${entry.id}`}
                  to={`/content/${slugify(entry.title)}`}
                  className="block h-full"
                >
                  <ResourceCard item={{ ...toResource(entry), progress: wp.progress }} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section ref={historyRef} id="watch-history" className="scroll-mt-28">
          <div className="mb-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Watch History</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every video you've opened on Hyvemind, newest first.
            </p>
          </div>
          {watched.length === 0 ? (
            <EmptyLibraryState
              title="No watch history yet"
              description="Once you open a video, it'll be tracked here for easy revisit."
              ctaLabel="Explore Resources"
              ctaTo="/explore"
            />
          ) : (
            <ul className="space-y-3">
              {watched.map(({ entry, wp }) => {
                const completed = wp.completed;
                return (
                  <li key={`hist-${entry.id}`}>
                    <Link
                      to={`/content/${slugify(entry.title)}`}
                      className={`group flex items-center gap-4 rounded-xl border p-3 transition ${
                        completed
                          ? "border-primary/40 bg-primary/5 hover:border-primary/60"
                          : "border-border/60 bg-card/40 hover:border-foreground/30 hover:bg-card/70"
                      }`}
                    >
                      <div className="relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/60">
                        {entry.thumbnail && (
                          <img
                            src={entry.thumbnail}
                            alt={entry.title}
                            loading="lazy"
                            className={`absolute inset-0 h-full w-full object-cover ${
                              completed ? "opacity-70" : ""
                            }`}
                          />
                        )}
                        {completed ? (
                          <CheckCircle2 className="relative h-6 w-6 text-primary" />
                        ) : (
                          <Play className="relative h-5 w-5 text-foreground/80" fill="currentColor" />
                        )}
                        <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                          {entry.duration}
                        </span>
                        {!completed && wp.progress > 0 && (
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-background/60">
                            <div
                              className="h-full bg-gradient-neon"
                              style={{ width: `${wp.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded border border-foreground/15 bg-background/60 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-[0.18em] text-foreground/80">
                            {entry.type}
                          </span>
                          {completed ? (
                            <span className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-[0.18em] text-primary">
                              <CheckCircle2 className="h-3 w-3" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded border border-foreground/15 bg-background/60 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {wp.progress}% watched
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {relativeTime(wp.lastWatchedAt)}
                          </span>
                        </div>
                        <h3 className="truncate text-sm font-semibold text-foreground transition group-hover:text-primary">
                          {entry.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">{entry.author}</p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-4 pr-2 text-xs text-muted-foreground sm:flex">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {formatCount(entry.views ?? 0)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" />
                          {formatCount(entry.likes ?? 0)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
};

export default RecentlyViewed;
