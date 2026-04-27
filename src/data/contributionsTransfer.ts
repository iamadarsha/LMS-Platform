import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";

type ContributionRow = Tables<"contributions">;
type ContributionInsert = TablesInsert<"contributions">;

const VIDEO_BUCKET = "contribution-videos";
const MANIFEST_NAME = "contributions.json";
const ASSETS_DIR = "assets";
const EXPORT_VERSION = 1;
const CONTRIBUTIONS_CHANGED_EVENT = "hyvemind:contributions-changed";

type ManifestEntry = {
  row: ContributionRow;
  videoAsset?: string;
  thumbnailAsset?: string;
};

type Manifest = {
  version: number;
  exportedAt: string;
  count: number;
  entries: ManifestEntry[];
};

function isCloudPath(value?: string | null) {
  return Boolean(value && !/^https?:|^blob:|^data:|^\//.test(value));
}

function notifyContributionsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONTRIBUTIONS_CHANGED_EVENT));
  }
}

async function downloadAsset(path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).download(path);
  if (error || !data) return null;
  return data;
}

function safeAssetName(originalPath: string, fallback: string) {
  const tail = originalPath.split("/").pop() || fallback;
  return tail.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export type ExportProgress = (info: { current: number; total: number; label: string }) => void;

export async function exportContributionsZip(onProgress?: ExportProgress): Promise<Blob> {
  const { data: rows, error } = await supabase
    .from("contributions")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const list = rows ?? [];

  const zip = new JSZip();
  const assetsFolder = zip.folder(ASSETS_DIR);
  if (!assetsFolder) throw new Error("Failed to create assets folder in archive.");

  const entries: ManifestEntry[] = [];
  const totalSteps = list.length * 2 + 1;
  let stepIndex = 0;

  for (const row of list) {
    const entry: ManifestEntry = { row };

    if (isCloudPath(row.video_url)) {
      onProgress?.({ current: ++stepIndex, total: totalSteps, label: `Video: ${row.title}` });
      const blob = await downloadAsset(row.video_url as string);
      if (blob) {
        const assetName = `${row.id}-video-${safeAssetName(row.video_url as string, "video.mp4")}`;
        assetsFolder.file(assetName, blob);
        entry.videoAsset = assetName;
      }
    } else {
      stepIndex++;
    }

    if (isCloudPath(row.thumbnail)) {
      onProgress?.({ current: ++stepIndex, total: totalSteps, label: `Thumbnail: ${row.title}` });
      const blob = await downloadAsset(row.thumbnail as string);
      if (blob) {
        const assetName = `${row.id}-thumb-${safeAssetName(row.thumbnail as string, "thumb.png")}`;
        assetsFolder.file(assetName, blob);
        entry.thumbnailAsset = assetName;
      }
    } else {
      stepIndex++;
    }

    entries.push(entry);
  }

  const manifest: Manifest = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    count: list.length,
    entries,
  };

  zip.file(MANIFEST_NAME, JSON.stringify(manifest, null, 2));
  onProgress?.({ current: totalSteps, total: totalSteps, label: "Building archive" });

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function ensureUserId() {
  const { data } = await supabase.auth.getUser();
  if (data.user) return data.user.id;
  throw new Error(
    "You need to be signed in to import resources. Open the app, sign in (or create an account), then return to /studio/transfer and try again.",
  );
}

async function uploadAssetBlob(userId: string, blob: Blob, originalName: string, kind: "video" | "thumb") {
  const folder = kind === "thumb" ? `${userId}/thumbnails` : userId;
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const contentType = blob.type || (kind === "thumb" ? "image/png" : "video/mp4");
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export type ImportProgress = (info: { current: number; total: number; label: string }) => void;
export type ImportResult = { imported: number; skipped: number; total: number };

export async function importContributionsZip(file: File, onProgress?: ImportProgress): Promise<ImportResult> {
  const userId = await ensureUserId();
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file(MANIFEST_NAME);
  if (!manifestFile) throw new Error("Archive is missing contributions.json.");
  const manifest = JSON.parse(await manifestFile.async("string")) as Manifest;
  if (!manifest.entries || !Array.isArray(manifest.entries)) {
    throw new Error("Archive manifest is invalid.");
  }

  const total = manifest.entries.length;
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < manifest.entries.length; i++) {
    const entry = manifest.entries[i];
    const row = entry.row;
    onProgress?.({ current: i + 1, total, label: row.title || "Contribution" });

    let videoPath: string | null = row.video_url;
    let thumbnailPath: string | null = row.thumbnail;

    if (entry.videoAsset) {
      const assetFile = zip.file(`${ASSETS_DIR}/${entry.videoAsset}`);
      if (assetFile) {
        const blob = await assetFile.async("blob");
        videoPath = await uploadAssetBlob(userId, blob, entry.videoAsset, "video");
      }
    }

    if (entry.thumbnailAsset) {
      const assetFile = zip.file(`${ASSETS_DIR}/${entry.thumbnailAsset}`);
      if (assetFile) {
        const blob = await assetFile.async("blob");
        thumbnailPath = await uploadAssetBlob(userId, blob, entry.thumbnailAsset, "thumb");
      }
    }

    const insertRow: ContributionInsert = {
      user_id: userId,
      type: row.type,
      icon: row.icon,
      title: row.title,
      author: row.author,
      duration: row.duration,
      submitted_at: row.submitted_at,
      progress: row.progress,
      glow: row.glow,
      views: row.views,
      likes: row.likes,
      xp: row.xp,
      description: row.description,
      tags: row.tags ?? [],
      summary: row.summary,
      steps: (row.steps ?? []) as Json,
      learnings: row.learnings ?? [],
      video_url: videoPath,
      thumbnail: thumbnailPath,
      status: row.status ?? "published",
    };

    const { error } = await supabase.from("contributions").insert(insertRow);
    if (error) {
      console.error("Failed to import contribution:", row.title, error);
      skipped++;
    } else {
      imported++;
    }
  }

  notifyContributionsChanged();
  return { imported, skipped, total };
}
