import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Captions, Play } from "lucide-react";
import { getSignedVideoUrl } from "@/data/contributionsStore";
import { getStoredVideoObjectUrl, isStoredVideoRef } from "@/data/videoStore";
import { upsertWatchProgress, clearWatchProgress } from "@/data/watchProgressStore";
import { segmentsToVtt, vttBlobUrl } from "@/lib/vtt";
import type { TranscriptSegment } from "@/data/content";
import { cn } from "@/lib/utils";

const DEFAULT_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    return null;
  } catch {
    return null;
  }
}

export type VideoPlayerHandle = {
  seekTo: (seconds: number) => void;
};

type Props = {
  src?: string;
  duration?: string;
  progress?: number;
  poster?: string;
  contributionId?: string;
  initialPositionSeconds?: number;
  onProgressUpdate?: (info: { positionSeconds: number; durationSeconds: number; progress: number }) => void;
  onCurrentTime?: (seconds: number) => void;
  transcriptSegments?: TranscriptSegment[];
  language?: string;
  ccEnabled?: boolean;
  onToggleCc?: () => void;
};

const SAVE_INTERVAL_MS = 5000;
const CURRENT_TIME_INTERVAL_MS = 250; // ~4 fps — enough for the live transcript without thrash

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  {
    src,
    duration,
    progress = 0,
    poster,
    contributionId,
    initialPositionSeconds = 0,
    onProgressUpdate,
    onCurrentTime,
    transcriptSegments,
    language,
    ccEnabled,
    onToggleCc,
  },
  ref,
) {
  const [playing, setPlaying] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedAt = useRef(0);
  const lastCurrentTimeAt = useRef(0);
  const seekedRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds: number) {
        const v = videoRef.current;
        if (!v) return;
        try {
          v.currentTime = Math.max(0, seconds);
          if (v.paused) {
            void v.play().catch(() => {
              /* user gesture may be required; ignore */
            });
          }
        } catch {
          // some browsers throw if metadata isn't loaded yet
        }
      },
    }),
    [],
  );

  // Generate the VTT blob URL when transcript segments are present so the
  // browser-native CC track can render captions over the video.
  const vttUrl = useMemo(() => {
    if (!transcriptSegments || transcriptSegments.length === 0) return null;
    return vttBlobUrl(segmentsToVtt(transcriptSegments));
  }, [transcriptSegments]);

  useEffect(() => {
    return () => {
      if (vttUrl) URL.revokeObjectURL(vttUrl);
    };
  }, [vttUrl]);

  // Toggle the textTrack mode in sync with the parent's ccEnabled prop so the
  // browser shows/hides the captions overlay.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !v.textTracks || v.textTracks.length === 0) return;
    const track = v.textTracks[0];
    if (track) track.mode = ccEnabled ? "showing" : "hidden";
  }, [ccEnabled, vttUrl, playing]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function resolveVideo() {
      if (isStoredVideoRef(src)) {
        objectUrl = await getStoredVideoObjectUrl(src as string);
        if (!cancelled) setResolvedSrc(objectUrl);
        return;
      }
      if (src && !/^https?:|^blob:|^data:/.test(src)) {
        const signedUrl = await getSignedVideoUrl(src);
        if (!cancelled) setResolvedSrc(signedUrl);
        return;
      }
      setResolvedSrc(src && src.length > 0 ? src : null);
    }

    resolveVideo();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const url = resolvedSrc ?? DEFAULT_VIDEO;
  const embed = toEmbedUrl(url);

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    if (!seekedRef.current && initialPositionSeconds > 0 && initialPositionSeconds < v.duration - 1) {
      v.currentTime = initialPositionSeconds;
    }
    seekedRef.current = true;
  }

  function reportProgress(force = false) {
    const v = videoRef.current;
    if (!v || !v.duration || Number.isNaN(v.duration)) return;
    const pct = Math.min(100, Math.max(0, Math.round((v.currentTime / v.duration) * 100)));
    onProgressUpdate?.({ positionSeconds: v.currentTime, durationSeconds: v.duration, progress: pct });
    if (!contributionId) return;
    const now = Date.now();
    if (!force && now - lastSavedAt.current < SAVE_INTERVAL_MS) return;
    lastSavedAt.current = now;
    void upsertWatchProgress({
      contributionId,
      positionSeconds: v.currentTime,
      durationSeconds: v.duration,
    });
  }

  function reportCurrentTime() {
    if (!onCurrentTime) return;
    const v = videoRef.current;
    if (!v) return;
    const now = Date.now();
    if (now - lastCurrentTimeAt.current < CURRENT_TIME_INTERVAL_MS) return;
    lastCurrentTimeAt.current = now;
    onCurrentTime(v.currentTime);
  }

  function handleTimeUpdate() {
    reportProgress(false);
    reportCurrentTime();
  }

  function handlePause() {
    reportProgress(true);
  }

  function handleEnded() {
    if (!contributionId) return;
    void clearWatchProgress(contributionId);
  }

  const showCcToggle = Boolean(transcriptSegments && transcriptSegments.length > 0 && onToggleCc);

  return (
    <div className="neon-border neon-violet overflow-hidden">
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {!playing ? (
          <>
            {poster && (
              <img
                src={poster}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(0_0%_100%/0.08),transparent_70%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label="Play video"
                className="flex h-20 w-20 items-center justify-center rounded-full border border-foreground/20 bg-background/40 backdrop-blur-md transition hover:scale-110 hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Play className="h-7 w-7 text-foreground" fill="currentColor" />
              </button>
            </div>
            {/* CC toggle visible even before play when transcript is available */}
            {showCcToggle && (
              <button
                type="button"
                onClick={onToggleCc}
                aria-pressed={ccEnabled}
                aria-label={ccEnabled ? "Hide captions" : "Show captions"}
                className={cn(
                  "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  ccEnabled
                    ? "border-primary/70 bg-primary/20 text-primary-foreground shadow-violet"
                    : "border-foreground/20 bg-background/60 text-foreground hover:border-foreground/40",
                )}
              >
                <Captions className="h-3.5 w-3.5" />
                CC
              </button>
            )}
            {duration && (
              <span className="absolute bottom-4 right-4 rounded-md border border-foreground/10 bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
                {duration}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-border/40">
              <div
                className="h-full bg-gradient-neon"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : embed ? (
          <iframe
            src={embed}
            title="Video player"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <video
            ref={videoRef}
            src={url}
            controls
            autoPlay
            playsInline
            crossOrigin={vttUrl ? "anonymous" : undefined}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPause={handlePause}
            onEnded={handleEnded}
            className="absolute inset-0 h-full w-full bg-black"
          >
            {vttUrl && (
              <track
                kind="subtitles"
                srcLang={language || "en"}
                label={language ? language.toUpperCase() : "Captions"}
                src={vttUrl}
                default={ccEnabled}
              />
            )}
          </video>
        )}

        {playing && showCcToggle && (
          <button
            type="button"
            onClick={onToggleCc}
            aria-pressed={ccEnabled}
            aria-label={ccEnabled ? "Hide captions" : "Show captions"}
            className={cn(
              "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              ccEnabled
                ? "border-primary/70 bg-primary/20 text-primary-foreground shadow-violet"
                : "border-foreground/20 bg-background/60 text-foreground hover:border-foreground/40",
            )}
          >
            <Captions className="h-3.5 w-3.5" />
            CC
          </button>
        )}
      </div>
    </div>
  );
});
