import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Captions } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "@/data/content";

type Props = {
  segments: TranscriptSegment[];
  fallbackText?: string;
  language?: string;
  currentTime: number;
  onSeek: (seconds: number) => void;
  /** Optional controlled state for the collapsible. Defaults to expanded. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function findActiveIndex(segments: TranscriptSegment[], t: number): number {
  if (segments.length === 0) return -1;
  // Linear scan is fine — typical transcripts are <= a few hundred segments.
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (t >= s.start && t < s.end) return i;
  }
  // Fall back to last segment when we're past its end.
  if (t >= segments[segments.length - 1].end) return segments.length - 1;
  return -1;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const USER_SCROLL_LOCK_MS = 1500;

export function TranscriptPanel({
  segments,
  fallbackText,
  language,
  currentTime,
  onSeek,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(true);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const listRef = useRef<HTMLOListElement | null>(null);
  const lastUserScrollAt = useRef(0);
  const reducedMotion = useRef(prefersReducedMotion());

  useEffect(() => {
    const handler = () => {
      reducedMotion.current = prefersReducedMotion();
    };
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mql?.addEventListener?.("change", handler);
    return () => mql?.removeEventListener?.("change", handler);
  }, []);

  const activeIndex = useMemo(
    () => findActiveIndex(segments, currentTime),
    [segments, currentTime],
  );

  // Auto-scroll the active segment into view, but only if the user hasn't
  // manually scrolled the panel in the recent past.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const now = Date.now();
    if (now - lastUserScrollAt.current < USER_SCROLL_LOCK_MS) return;
    const list = listRef.current;
    if (!list) return;
    const target = list.children[activeIndex] as HTMLElement | undefined;
    if (!target) return;
    // Scroll ONLY the panel's internal list — never the page. We compute the
    // offset within the scroll container directly so the browser doesn't
    // bubble the scroll up to the window (which scrollIntoView does when the
    // panel itself isn't fully visible).
    const desiredTop =
      target.offsetTop - list.clientHeight / 2 + target.clientHeight / 2;
    list.scrollTo({
      top: Math.max(0, desiredTop),
      behavior: reducedMotion.current ? "auto" : "smooth",
    });
  }, [activeIndex, open]);

  if (segments.length === 0) {
    if (!fallbackText) return null;
    return (
      <section className="neon-border neon-subtle space-y-3 p-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Captions className="h-4 w-4 text-primary" />
            Transcript
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            />
          </button>
        </header>
        {open && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {fallbackText}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="neon-border neon-subtle space-y-3 p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
          <Captions className="h-4 w-4 text-primary" />
          <span>Transcript</span>
          <span className="text-xs font-normal text-muted-foreground">
            {segments.length} segments{language ? ` · ${language.toUpperCase()}` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Collapse transcript" : "Expand transcript"}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </header>

      {open && (
        <ol
          ref={listRef}
          onScroll={() => {
            lastUserScrollAt.current = Date.now();
          }}
          className="max-h-[460px] space-y-1 overflow-y-auto pr-2"
        >
          {segments.map((seg, i) => {
            const isActive = i === activeIndex;
            return (
              <li key={`${seg.start}-${i}`}>
                <button
                  type="button"
                  onClick={() => onSeek(seg.start)}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    isActive
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-4 w-0.5 shrink-0 rounded-full transition",
                      isActive ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <span className="font-mono text-[11px] tabular-nums text-primary/80 shrink-0 pt-0.5">
                    {formatTimestamp(seg.start)}
                  </span>
                  <span
                    className={cn(
                      "text-sm leading-relaxed transition",
                      isActive ? "font-medium" : "",
                    )}
                  >
                    {seg.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
