export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type ContentEntry = {
  id?: string;
  userId?: string;
  type: string;
  icon?: "video" | "tutorial";
  title: string;
  author: string;
  duration: string;
  submittedAt?: string;
  progress?: number;
  glow?: "cyan" | "pink" | "violet";
  views?: number;
  likes?: number;
  xp?: number;
  description?: string;
  tags?: string[];
  summary?: string;
  steps?: ContentStep[];
  learnings?: string[];
  videoUrl?: string;
  thumbnail?: string;
  transcript?: string;
  transcriptSegments?: TranscriptSegment[];
  detectedLanguage?: string;
};

export type ContentStep = {
  title: string;
  body: string;
  tags?: string[];
  keyStep?: boolean;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Returns the full library: built-in seed content plus any user contributions
 * stored locally. User contributions appear first.
 */
export function getFullLibrary(): ContentEntry[] {
  if (typeof window === "undefined") return contentLibrary;
  try {
    const raw = window.localStorage.getItem("hyvemind:contributions");
    const user = raw ? (JSON.parse(raw) as ContentEntry[]) : [];
    return [...(Array.isArray(user) ? user : []), ...contentLibrary];
  } catch {
    return contentLibrary;
  }
}

export const contentLibrary: ContentEntry[] = [];