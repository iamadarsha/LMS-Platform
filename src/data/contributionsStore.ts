import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { ContentEntry, ContentStep, TranscriptSegment } from "./content";
import { getStoredVideoBlob, isStoredVideoRef } from "./videoStore";

type ContributionRow = Tables<"contributions"> & {
  // Added by 20260427000001_add_transcript_to_contributions.sql.
  // Until the generated types are regenerated, treat them as optional.
  transcript?: string | null;
  transcript_segments?: Json | null;
  detected_language?: string | null;
};

function safeSegments(value: Json | null | undefined): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  const out: TranscriptSegment[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const start = Number(r.start);
    const end = Number(r.end);
    const text = typeof r.text === "string" ? r.text : "";
    if (Number.isFinite(start) && Number.isFinite(end) && text) {
      out.push({ start, end, text });
    }
  }
  return out;
}
const STORAGE_KEY = "hyvemind:contributions";
const MIGRATION_KEY = "hyvemind:contributions:cloud-migrated";
const REPAIR_KEY = "hyvemind:contributions:cloud-video-repair";
const VIDEO_BUCKET = "contribution-videos";
const CONTRIBUTIONS_CHANGED_EVENT = "hyvemind:contributions-changed";

function safeSteps(value: Json): ContentStep[] {
  return Array.isArray(value) ? (value as ContentStep[]) : [];
}

function fromRow(row: ContributionRow): ContentEntry {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    icon: row.icon === "tutorial" ? "tutorial" : "video",
    title: row.title,
    author: row.author,
    duration: row.duration,
    submittedAt: row.submitted_at,
    progress: row.progress,
    glow: row.glow === "cyan" || row.glow === "pink" || row.glow === "violet" ? row.glow : undefined,
    views: row.views,
    likes: row.likes,
    xp: row.xp,
    description: row.description ?? undefined,
    tags: row.tags,
    summary: row.summary ?? undefined,
    steps: safeSteps(row.steps),
    learnings: row.learnings,
    videoUrl: row.video_url ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    transcript: row.transcript ?? undefined,
    transcriptSegments: safeSegments(row.transcript_segments),
    detectedLanguage: row.detected_language ?? undefined,
  };
}

function isBlobUrl(value?: string | null) {
  return Boolean(value?.startsWith("blob:"));
}

function sanitizePersistedVideoUrl(value?: string | null) {
  if (!value || isBlobUrl(value) || isStoredVideoRef(value)) return undefined;
  return value;
}

function isCloudStoragePath(value?: string | null) {
  return Boolean(value && !/^(https?:|blob:|data:|\/)/.test(value));
}

function notifyContributionsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONTRIBUTIONS_CHANGED_EVENT));
}

async function getBlobFromUrl(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

function fileExtensionFromType(type?: string) {
  if (type === "video/webm") return "webm";
  if (type === "video/quicktime") return "mov";
  return "mp4";
}

function matchLocalContribution(localItems: ContentEntry[], row: ContributionRow) {
  return localItems.find(
    (item) =>
      (item.id && item.id === row.id) ||
      (item.title === row.title && item.submittedAt === row.submitted_at) ||
      item.title === row.title,
  );
}

async function buildRepairFile(row: ContributionRow, localItem?: ContentEntry) {
  let blob = null as Blob | null;

  if (localItem?.videoUrl && isStoredVideoRef(localItem.videoUrl)) {
    blob = await getStoredVideoBlob(localItem.videoUrl);
  }

  if (!blob && localItem?.videoUrl && isBlobUrl(localItem.videoUrl)) {
    blob = await getBlobFromUrl(localItem.videoUrl);
  }

  if (!blob && row.video_url && isBlobUrl(row.video_url)) {
    blob = await getBlobFromUrl(row.video_url);
  }

  if (!blob) return null;

  return new File([blob], `${row.title || "video"}.${fileExtensionFromType(blob.type)}`, {
    type: blob.type || "video/mp4",
  });
}

async function ensureUserId() {
  const { data } = await supabase.auth.getUser();
  if (data.user) return data.user.id;
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) throw error ?? new Error("Unable to create a contributor session.");
  return signIn.user.id;
}

export async function uploadContributionVideo(file: File) {
  const userId = await ensureUserId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function uploadContributionThumbnail(file: File) {
  const userId = await ensureUserId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/thumbnails/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/**
 * Upload an asset that lives at a public URL (e.g. a /thumbnails/*.png preset)
 * into cloud storage so the persisted thumbnail always points to a permanent
 * cloud-hosted file rather than a static path bundled with the client.
 */
export async function uploadContributionThumbnailFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch thumbnail: ${response.status}`);
  const blob = await response.blob();
  const inferredName = url.split("/").pop()?.split("?")[0] || "thumbnail.png";
  const file = new File([blob], inferredName, { type: blob.type || "image/png" });
  return uploadContributionThumbnail(file);
}

/**
 * Detect contributions whose video is hosted on R2 (via the FastAPI pipeline).
 * The convention is `r2:<jobId>` — resolved server-side to a fresh presigned URL.
 */
export function isR2VideoRef(path: string | null | undefined): path is string {
  return typeof path === "string" && path.startsWith("r2:");
}

export async function getR2SignedUrl(jobId: string): Promise<string> {
  const res = await fetch(`/api/contributions/${jobId}/video`);
  if (!res.ok) throw new Error(`Failed to resolve R2 video (${res.status})`);
  const { url } = await res.json();
  return url as string;
}

export async function getSignedVideoUrl(path: string) {
  if (isR2VideoRef(path)) {
    return getR2SignedUrl(path.slice(3));
  }
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function getSignedAssetUrl(path: string) {
  if (!isCloudStoragePath(path)) return path;
  return getSignedVideoUrl(path);
}

function buildContributionPayload(entry: ContentEntry, userId: string, includeTranscript: boolean) {
  const persistedVideoUrl = sanitizePersistedVideoUrl(entry.videoUrl);
  const base = {
    user_id: userId,
    type: entry.type,
    icon: entry.icon ?? "video",
    title: entry.title,
    author: entry.author,
    duration: entry.duration,
    submitted_at: entry.submittedAt,
    progress: entry.progress ?? 0,
    glow: entry.glow,
    views: entry.views ?? 0,
    likes: entry.likes ?? 0,
    xp: entry.xp ?? 10,
    description: entry.description,
    tags: entry.tags ?? [],
    summary: entry.summary,
    steps: (entry.steps ?? []) as unknown as Json,
    learnings: entry.learnings ?? [],
    video_url: persistedVideoUrl,
    thumbnail: entry.thumbnail,
    status: "published",
  };
  if (!includeTranscript) return base;
  const hasTranscript = entry.transcript || (entry.transcriptSegments && entry.transcriptSegments.length > 0);
  if (!hasTranscript) return base;
  return {
    ...base,
    transcript: entry.transcript ?? null,
    transcript_segments: (entry.transcriptSegments ?? null) as unknown as Json,
    detected_language: entry.detectedLanguage ?? null,
  };
}

function isUnknownColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "PGRST204" || e.code === "42703") return true;
  return Boolean(e.message && /column .* (does not exist|could not be found)/i.test(e.message));
}

export async function addContribution(entry: ContentEntry) {
  const userId = await ensureUserId();

  // First attempt: include transcript fields. If the Supabase schema hasn't
  // been migrated yet (column not found), retry without them so existing
  // deployments keep working.
  let { error } = await supabase
    .from("contributions")
    .insert(buildContributionPayload(entry, userId, true) as never);
  if (error && isUnknownColumnError(error)) {
    console.warn(
      "Supabase contributions table is missing transcript columns. Apply migration 20260427000001_add_transcript_to_contributions.sql to enable synced transcripts.",
    );
    ({ error } = await supabase
      .from("contributions")
      .insert(buildContributionPayload(entry, userId, false) as never));
  }
  if (error) throw error;
}

async function migrateLocalContributions() {
  if (typeof window === "undefined" || window.localStorage.getItem(MIGRATION_KEY)) return;
  const local = readLocalContributions();
  if (local.length === 0) {
    window.localStorage.setItem(MIGRATION_KEY, "true");
    return;
  }
  for (const item of local) {
    let videoUrl = sanitizePersistedVideoUrl(item.videoUrl);
    if (videoUrl && isStoredVideoRef(videoUrl)) {
      const blob = await getStoredVideoBlob(videoUrl);
      if (blob) videoUrl = await uploadContributionVideo(new File([blob], `${item.title || "video"}.mp4`, { type: blob.type || "video/mp4" }));
    } else if (item.videoUrl && isStoredVideoRef(item.videoUrl)) {
      const blob = await getStoredVideoBlob(item.videoUrl);
      if (blob) videoUrl = await uploadContributionVideo(new File([blob], `${item.title || "video"}.mp4`, { type: blob.type || "video/mp4" }));
    } else if (item.videoUrl && isBlobUrl(item.videoUrl)) {
      const blob = await getBlobFromUrl(item.videoUrl);
      if (blob) {
        videoUrl = await uploadContributionVideo(
          new File([blob], `${item.title || "video"}.${fileExtensionFromType(blob.type)}`, {
            type: blob.type || "video/mp4",
          }),
        );
      }
    }
    await addContribution({ ...item, videoUrl });
  }
  window.localStorage.setItem(MIGRATION_KEY, "true");
}

async function repairCloudContributionVideos(rows: ContributionRow[]) {
  if (typeof window === "undefined" || window.sessionStorage.getItem(REPAIR_KEY)) return rows;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return rows;

  const localItems = readLocalContributions();
  const repairedRows = new Map<string, ContributionRow>();

  for (const row of rows) {
    if (row.user_id !== user.id || !isBlobUrl(row.video_url)) continue;

    const repairFile = await buildRepairFile(row, matchLocalContribution(localItems, row));
    if (!repairFile) continue;

    const uploadedPath = await uploadContributionVideo(repairFile);
    const { data, error } = await supabase
      .from("contributions")
      .update({ video_url: uploadedPath })
      .eq("id", row.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (!error && data) repairedRows.set(row.id, data);
  }

  window.sessionStorage.setItem(REPAIR_KEY, "true");

  return rows.map((row) => repairedRows.get(row.id) ?? row);
}

export async function deleteContribution(entry: ContentEntry) {
  if (!entry.id) return;
  const storagePaths = [entry.videoUrl, entry.thumbnail].filter(isCloudStoragePath);
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from(VIDEO_BUCKET).remove(storagePaths);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from("contributions").delete().eq("id", entry.id);
  if (error) throw error;
  notifyContributionsChanged();
}

function readLocalContributions(): ContentEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getContributions(): ContentEntry[] {
  return readLocalContributions();
}

export type UseContributionsResult = {
  items: ContentEntry[];
  isLoading: boolean;
};

/**
 * Subscribe to the user's contributions. Returns an `isLoading` flag so
 * consumers can distinguish "still fetching" from "definitively empty"
 * (which is what caused the 404 flash on /content/:slug navigations).
 */
export function useContributions(): UseContributionsResult {
  const [items, setItems] = useState<ContentEntry[]>(() =>
    typeof window === "undefined" ? [] : readLocalContributions(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        await migrateLocalContributions();
        const { data } = await supabase
          .from("contributions")
          .select("*")
          .order("created_at", { ascending: false });
        if (!mounted) return;
        if (data) {
          const repaired = await repairCloudContributionVideos(data);
          if (mounted) setItems(repaired.map(fromRow));
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    window.addEventListener(CONTRIBUTIONS_CHANGED_EVENT, load);
    return () => {
      mounted = false;
      window.removeEventListener(CONTRIBUTIONS_CHANGED_EVENT, load);
    };
  }, []);

  return { items, isLoading };
}