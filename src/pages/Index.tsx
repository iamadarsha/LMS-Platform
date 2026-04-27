import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import {
  ResourceCard,
  SectionHeader,
  type ResourceItem,
} from "@/components/dashboard/MediaCard";
import { contentLibrary, slugify, type ContentEntry } from "@/data/content";
import { useContributions } from "@/data/contributionsStore";
import { useWatchProgress } from "@/data/watchProgressStore";
import { EmptyLibraryState } from "@/components/EmptyLibraryState";

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

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("in-view");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border/40 bg-card p-4 space-y-3">
      <div className="aspect-video w-full rounded-xl bg-muted/60" />
      <div className="h-3 w-1/3 rounded bg-muted/60" />
      <div className="h-5 w-4/5 rounded bg-muted/60" />
      <div className="h-3 w-2/3 rounded bg-muted/60" />
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

const Index = () => {
  const { items: contributions, isLoading } = useContributions();
  const watchProgress = useWatchProgress();
  const library = [...contributions, ...contentLibrary];
  const resources = library.map(toResource);

  const continueRef = useScrollReveal<HTMLElement>();
  const trendingRef = useScrollReveal<HTMLElement>();
  const exploreRef = useScrollReveal<HTMLElement>();

  const continueWatching = library
    .filter((c) => {
      if (!c.id) return false;
      const wp = watchProgress.get(c.id);
      return Boolean(wp && !wp.completed && (wp.progress > 0 || wp.positionSeconds > 0));
    })
    .sort((a, b) => {
      const aw = watchProgress.get(a.id!);
      const bw = watchProgress.get(b.id!);
      const aTime = aw ? new Date(aw.lastWatchedAt).getTime() : 0;
      const bTime = bw ? new Date(bw.lastWatchedAt).getTime() : 0;
      return bTime - aTime;
    })
    .map((c) => {
      const wp = watchProgress.get(c.id!);
      return {
        ...toResource(c),
        progress: wp?.progress ?? c.progress,
      };
    });

  return (
    <div className="blueprint-bg min-h-screen text-foreground">
      <span className="blueprint-spark" style={{ top: "8%", left: "18%", animationDelay: "0s" }} />
      <span className="blueprint-spark" style={{ top: "22%", left: "62%", animationDelay: "1.2s" }} />
      <span className="blueprint-spark" style={{ top: "40%", left: "38%", animationDelay: "1.8s" }} />

      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="ml-64 flex-1 px-8 pb-24 pt-24">
          <div className="mx-auto max-w-[1400px] space-y-16">
            <section className="relative pt-8 text-center">
              <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[120%] -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-7xl">
                Your partner in <br />
                <span className="text-gradient">intelligence acceleration.</span>
              </h1>
              <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Learn across 60+ domains with tutorials, experts and AI workflows
                that solve every piece of the modern build equation.
              </p>
              <Link
                to="/explore"
                className="group mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Explore Resources
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </section>

            <section ref={continueRef} className="reveal">
              <SectionHeader
                title="Continue Watching"
                subtitle="Pick up where you left off"
                seeAllTo="/recently-viewed#continue-watching"
              />
              {isLoading ? (
                <SectionSkeleton />
              ) : continueWatching.length === 0 ? (
                <EmptyLibraryState />
              ) : (
                <div className="reveal-stack grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {continueWatching.slice(0, 3).map((item) => (
                    <Link key={`continue-${item.title}`} to={`/content/${slugify(item.title)}`} className="block h-full">
                      <ResourceCard item={item} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section ref={trendingRef} className="reveal">
              <SectionHeader title="What's Trending" subtitle="Popular resources across the community" />
              {isLoading ? (
                <SectionSkeleton />
              ) : resources.length === 0 ? (
                <EmptyLibraryState />
              ) : (
                <div className="reveal-stack grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {[...resources]
                    .sort((a, b) => (b.views ?? 0) + (b.likes ?? 0) - ((a.views ?? 0) + (a.likes ?? 0)))
                    .slice(0, 3)
                    .map((item) => (
                      <Link key={`trending-${item.title}`} to={`/content/${slugify(item.title)}`} className="block h-full">
                        <ResourceCard item={item} />
                      </Link>
                    ))}
                </div>
              )}
            </section>

            <section ref={exploreRef} className="reveal">
              <SectionHeader title="Explore All Resources" subtitle="Resources contributed by the community" />
              {isLoading ? (
                <SectionSkeleton />
              ) : resources.length === 0 ? (
                <EmptyLibraryState />
              ) : (
                <div className="reveal-stack grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {resources.map((item) => (
                    <Link key={item.title} to={`/content/${slugify(item.title)}`} className="block h-full">
                      <ResourceCard item={item} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
