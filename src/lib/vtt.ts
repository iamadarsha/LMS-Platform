import type { TranscriptSegment } from "@/data/content";

function formatVttTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/**
 * Convert structured transcript segments into a WEBVTT document. Used by the
 * native HTML5 `<track>` element so the browser can render closed captions
 * directly over the video.
 */
export function segmentsToVtt(segments: TranscriptSegment[]): string {
  if (segments.length === 0) return "WEBVTT\n";
  const cues = segments
    .filter((s) => s.text && Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s, i) => {
      const start = formatVttTimestamp(s.start);
      const end = formatVttTimestamp(Math.max(s.start + 0.1, s.end));
      // Strip stray `[mm:ss]` markers some transcripts pre-pend.
      const text = s.text.replace(/^\s*\[\d{1,2}:\d{2}\]\s*/, "").trim();
      return `${i + 1}\n${start} --> ${end}\n${text}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${cues}`;
}

/**
 * Wrap a VTT document in a Blob URL. Caller is responsible for revoking it
 * via URL.revokeObjectURL when no longer needed.
 */
export function vttBlobUrl(vtt: string): string {
  const blob = new Blob([vtt], { type: "text/vtt" });
  return URL.createObjectURL(blob);
}
