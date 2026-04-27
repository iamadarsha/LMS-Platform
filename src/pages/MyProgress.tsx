import { useMemo } from "react";
import { Flame, Trophy, Clock, Target } from "lucide-react";
import { PageShell } from "@/components/dashboard/PageShell";
import { contentLibrary, slugify, type ContentEntry } from "@/data/content";
import { useContributions } from "@/data/contributionsStore";
import { useWatchProgress, type WatchProgressEntry } from "@/data/watchProgressStore";
import { EmptyLibraryState } from "@/components/EmptyLibraryState";
import { Link } from "react-router-dom";

const WEEKLY_GOAL = 5;

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatWatchTime(totalSeconds: number) {
  if (totalSeconds <= 0) return "0m";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function computeStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // walk back day-by-day; allow today to be missing if yesterday is present
  let allowedSkipped = true;
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
      allowedSkipped = false;
    } else if (allowedSkipped) {
      allowedSkipped = false; // first day can be missing (today not yet watched)
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Monday-as-week-start
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d;
}

const MyProgress = () => {
  const { items: library } = useContributions();
  const watchProgress = useWatchProgress();

  const entries: WatchProgressEntry[] = useMemo(
    () => Array.from(watchProgress.values()),
    [watchProgress],
  );

  const stats = useMemo(() => {
    const watchTimeSec = entries.reduce(
      (acc, e) => acc + Math.max(0, e.positionSeconds || 0),
      0,
    );

    const completedCount = entries.filter((e) => e.completed).length;

    const days = new Set(entries.map((e) => dayKey(e.lastWatchedAt)));
    const streak = computeStreak(days);

    const weekStart = startOfWeek().getTime();
    const completedThisWeek = entries.filter(
      (e) => e.completed && new Date(e.lastWatchedAt).getTime() >= weekStart,
    ).length;

    return [
      { icon: Flame, label: "Day streak", value: streak ? String(streak) : "0" },
      { icon: Clock, label: "Watch time", value: formatWatchTime(watchTimeSec) },
      { icon: Trophy, label: "Completed", value: String(completedCount) },
      {
        icon: Target,
        label: "Weekly goal",
        value: `${Math.min(completedThisWeek, WEEKLY_GOAL)} / ${WEEKLY_GOAL}`,
      },
    ];
  }, [entries]);

  const fullLibrary: ContentEntry[] = useMemo(
    () => [...library, ...contentLibrary],
    [library],
  );

  const inProgress = useMemo(() => {
    return fullLibrary
      .filter((c): c is ContentEntry & { id: string } => Boolean(c.id))
      .map((c) => ({ entry: c, wp: watchProgress.get(c.id!)! }))
      .filter(({ wp }) => wp && !wp.completed && wp.progress > 0);
  }, [fullLibrary, watchProgress]);

  const completed = useMemo(() => {
    return fullLibrary
      .filter((c): c is ContentEntry & { id: string } => Boolean(c.id))
      .map((c) => ({ entry: c, wp: watchProgress.get(c.id!)! }))
      .filter(({ wp }) => wp?.completed);
  }, [fullLibrary, watchProgress]);

  const isEmpty = inProgress.length === 0 && completed.length === 0;

  return (
    <PageShell
      eyebrow="YOU // PROGRESS"
      title="My progress"
      description="Your learning streak, in-flight content and completed milestones — all in one place."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="neon-border neon-subtle space-y-2 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                {s.label}
              </div>
              <p className="text-3xl font-bold text-foreground">{s.value}</p>
            </div>
          );
        })}
      </div>

      {isEmpty ? (
        <EmptyLibraryState
          title="No progress yet"
          description="Start watching a resource — your streak, watch time and completion count will appear here."
        />
      ) : (
        <>
          {inProgress.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">In progress</h2>
              <ul className="space-y-3">
                {inProgress.map(({ entry, wp }) => (
                  <li key={`ip-${entry.id}`}>
                    <Link
                      to={`/content/${slugify(entry.title)}`}
                      className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/40 p-4 transition hover:border-foreground/30 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2 text-[11px]">
                          <span className="rounded border border-foreground/15 bg-background/60 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-[0.18em] text-foreground/80">
                            {entry.type}
                          </span>
                          <span className="text-muted-foreground">{entry.duration}</span>
                        </div>
                        <h3 className="truncate text-sm font-semibold text-foreground">{entry.title}</h3>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                          <div
                            className="h-full bg-gradient-neon"
                            style={{ width: `${wp.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-foreground">{wp.progress}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Recently completed</h2>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {completed.map(({ entry }) => (
                  <li key={`done-${entry.id}`}>
                    <Link
                      to={`/content/${slugify(entry.title)}`}
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4 transition hover:border-foreground/30 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Trophy className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-foreground">{entry.title}</h3>
                        <p className="text-xs text-muted-foreground">{entry.author}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </PageShell>
  );
};

export default MyProgress;
