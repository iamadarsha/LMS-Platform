import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  Eye,
  Heart,
  Play,
  Share2,
  Sparkles,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/VideoPlayer";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { FavouriteButton } from "@/components/FavouriteButton";
import { contentLibrary, slugify, type ContentStep } from "@/data/content";
import { useContributions } from "@/data/contributionsStore";
import { useWatchProgress } from "@/data/watchProgressStore";
import { useFavouriteCounts } from "@/data/favouritesStore";
import NotFound from "./NotFound";

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n}`;
}

const defaultSummary =
  "This video walks through the core ideas, demonstrates them in a real workflow, and leaves you with a repeatable approach you can apply immediately. Watch the full breakdown to see how each step connects into a single end-to-end practice.";

const defaultSteps: ContentStep[] = [
  {
    title: "Understand the Need for Targeted Changes",
    body: "Frame the problem clearly before touching anything. Identify the boundaries of what should change and what must stay the same so your edits stay intentional.",
    tags: ["concept", "problem identification"],
  },
  {
    title: "Select the Target Module or Section",
    body: "Begin by selecting the specific module, layer or frame where you intend to work. This establishes the initial scope for the targeted modification.",
    tags: ["action", "tool", "technique"],
    keyStep: true,
  },
  {
    title: "Expand Selection Using 'Same Properties'",
    body: "With the target module selected, expand your selection to all elements that share similar properties. This creates a broader, controlled context for the change.",
    tags: ["action", "tool", "technique"],
    keyStep: true,
  },
  {
    title: "Apply Changes & Verify",
    body: "Make the change in one move and immediately verify nothing leaked outside the intended scope. Ship confidently when the diff matches the plan.",
    tags: ["action", "validation"],
  },
];

const defaultLearnings = [
  "Core mental models behind the workflow",
  "Step-by-step setup of the environment",
  "Hands-on practice with real examples",
  "Patterns to scale this to production",
];

const ContentDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { items: contributions, isLoading } = useContributions();
  const watchProgress = useWatchProgress();
  const favouriteCounts = useFavouriteCounts();
  const library = useMemo(() => [...contributions, ...contentLibrary], [contributions]);
  const item = useMemo(
    () => library.find((c) => slugify(c.title) === slug),
    [slug, library],
  );

  // Live transcript state — declared up here so hooks order stays stable
  // across the early-return branches below.
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [ccOn, setCcOn] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  // While the contributions list is still loading we don't yet know whether
  // the slug resolves to a real entry, so render a skeleton inside the same
  // dashboard chrome instead of flashing the NotFound screen.
  if (!item && isLoading) return <ContentDetailSkeleton />;
  if (!item) return <NotFound />;

  const watchEntry = item.id ? watchProgress.get(item.id) : undefined;
  const currentProgress = watchEntry?.progress ?? item.progress ?? 0;

  const summary = item.summary ?? item.description ?? defaultSummary;
  const steps = item.steps && item.steps.length > 0 ? item.steps : defaultSteps;
  const learnings = item.learnings && item.learnings.length > 0 ? item.learnings : defaultLearnings;

  const related = library.filter((c) => c.title !== item.title).slice(0, 4);

  const transcriptSegments = item.transcriptSegments ?? [];
  const hasLiveTranscript = transcriptSegments.length > 0;

  return (
    <div className="blueprint-bg min-h-screen text-foreground">
      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="ml-64 flex-1 px-8 pb-24 pt-24">
          <div className="mx-auto max-w-[1400px] space-y-10">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to library
            </Link>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-8">
                {/* Player */}
                <VideoPlayer
                  ref={playerRef}
                  src={item.videoUrl}
                  duration={item.duration}
                  progress={currentProgress}
                  poster={item.thumbnail}
                  contributionId={item.id}
                  initialPositionSeconds={watchEntry?.positionSeconds ?? 0}
                  onCurrentTime={hasLiveTranscript ? setCurrentTime : undefined}
                  transcriptSegments={hasLiveTranscript ? transcriptSegments : undefined}
                  language={item.detectedLanguage}
                  ccEnabled={ccOn}
                  onToggleCc={
                    hasLiveTranscript
                      ? () => {
                          setCcOn((v) => !v);
                          setTranscriptOpen(true);
                          requestAnimationFrame(() => {
                            transcriptRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          });
                        }
                      : undefined
                  }
                />

                {(hasLiveTranscript || item.transcript) && (
                  <div ref={transcriptRef}>
                    <TranscriptPanel
                      segments={transcriptSegments}
                      fallbackText={item.transcript}
                      language={item.detectedLanguage}
                      currentTime={currentTime}
                      onSeek={(s) => playerRef.current?.seekTo(s)}
                      open={transcriptOpen}
                      onOpenChange={setTranscriptOpen}
                    />
                  </div>
                )}

                {/* Title block */}
                <header className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-foreground/15 bg-background/60 px-2 py-0.5 font-mono font-semibold uppercase tracking-[0.18em] text-foreground/80">
                      {item.type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {item.duration}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      {formatCount(item.views ?? 0)} views
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Heart className="h-3.5 w-3.5" />
                      {formatCount(item.id ? (favouriteCounts.get(item.id) ?? 0) : (item.likes ?? 0))} likes
                    </span>
                  </div>

                  <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                    {item.title}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    By <span className="text-foreground">{item.author}</span> · Updated 2 weeks ago
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <FavouriteButton
                      contributionId={item.id}
                      variant="pill"
                      showLabel
                    />
                    <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground transition hover:border-foreground/30">
                      <Bookmark className="h-4 w-4" />
                      Save
                    </button>
                    <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground transition hover:border-foreground/30">
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </div>
                </header>

                {/* About — extended */}
                <section className="neon-border neon-subtle space-y-6 p-6">
                  <div className="space-y-3">
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                      CORE_INTEL <span className="text-muted-foreground">// DETAILED_SUMMARY</span>
                    </p>
                    <p className="text-base leading-relaxed text-foreground/90">
                      {summary}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(item.tags ?? [item.type, "Hyvemind", "Practical"]).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground"
                      >
                        #{t.toLowerCase()}
                      </span>
                    ))}
                  </div>

                  {/* Step by step */}
                  <div className="space-y-1 pt-2">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Step by step
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      A walkthrough of what's covered in this {item.type.toLowerCase()}.
                    </p>
                  </div>

                  <ol className="divide-y divide-border/50">
                    {steps.map((step, i) => (
                      <li key={step.title} className="space-y-3 py-5 first:pt-2 last:pb-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                            STEP {i + 1}
                          </span>
                          {step.keyStep && (
                            <span className="rounded-full border border-neon-pink/60 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neon-pink">
                              KEY STEP
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold leading-snug text-foreground">
                          {step.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                        {step.tags && step.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {step.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              {/* Sidebar */}
              <aside className="space-y-6">
                {/* Author (moved up) */}
                <section className="neon-border neon-subtle p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-foreground/80">
                    Author
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground shadow-violet">
                      {item.author
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.author}</p>
                      <p className="text-xs text-muted-foreground">Hyvemind contributor</p>
                    </div>
                  </div>
                  <button className="mt-4 w-full rounded-full border border-border bg-card/60 py-2 text-sm font-medium text-foreground transition hover:border-foreground/30">
                    View profile
                  </button>
                </section>

                {/* What you'll learn */}
                <section className="neon-border neon-subtle p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-foreground/80">
                    What you'll learn
                  </h3>
                  <ul className="divide-y divide-border/50">
                    {learnings.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-3 py-3 text-sm text-foreground first:pt-0 last:pb-0"
                      >
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>

            {/* Up next — slim cards */}
            {related.length > 0 && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                    Up next
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hand-picked content to keep your momentum going
                  </p>
                </div>
                <ul className="space-y-3">
                  {related.map((r) => (
                    <li key={r.title}>
                      <Link
                        to={`/content/${slugify(r.title)}`}
                        className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card/40 p-3 transition hover:border-foreground/30 hover:bg-card/70"
                      >
                        <div className="relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/60">
                          <Play className="h-5 w-5 text-foreground/80" fill="currentColor" />
                          <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                            {r.duration}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2 text-[11px]">
                            <span className="rounded border border-foreground/15 bg-background/60 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-[0.18em] text-foreground/80">
                              {r.type}
                            </span>
                            <span className="text-muted-foreground">{r.author}</span>
                          </div>
                          <h3 className="truncate text-sm font-semibold text-foreground transition group-hover:text-primary">
                            {r.title}
                          </h3>
                        </div>
                        <div className="hidden shrink-0 items-center gap-4 pr-2 text-xs text-muted-foreground sm:flex">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {formatCount(r.views ?? 0)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5" />
                            {formatCount(r.id ? (favouriteCounts.get(r.id) ?? 0) : (r.likes ?? 0))}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

function ContentDetailSkeleton() {
  return (
    <div className="blueprint-bg min-h-screen text-foreground">
      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="ml-64 flex-1 px-8 pb-24 pt-24">
          <div className="mx-auto max-w-[1400px] space-y-10">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to library
            </div>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-8">
                <div className="neon-border neon-violet aspect-video w-full animate-pulse overflow-hidden bg-card/40" />
                <div className="space-y-4">
                  <div className="h-3 w-48 animate-pulse rounded bg-card/50" />
                  <div className="h-9 w-3/4 animate-pulse rounded bg-card/60" />
                  <div className="h-9 w-1/2 animate-pulse rounded bg-card/60" />
                  <div className="h-3 w-40 animate-pulse rounded bg-card/40" />
                </div>
                <div className="neon-border neon-subtle space-y-4 p-6">
                  <div className="h-3 w-32 animate-pulse rounded bg-card/50" />
                  <div className="h-3 w-full animate-pulse rounded bg-card/40" />
                  <div className="h-3 w-11/12 animate-pulse rounded bg-card/40" />
                  <div className="h-3 w-9/12 animate-pulse rounded bg-card/40" />
                </div>
              </div>
              <aside className="space-y-6">
                <div className="neon-border neon-subtle h-44 animate-pulse p-5" />
                <div className="neon-border neon-subtle h-56 animate-pulse p-5" />
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ContentDetail;