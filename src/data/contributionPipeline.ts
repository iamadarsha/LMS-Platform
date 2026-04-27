/**
 * Client for the local contribution pipeline backend.
 *
 * All requests are authenticated with a Clerk session bearer token. Callers
 * pass a `getToken` function (typically from `useAuth().getToken`) so the
 * client never needs direct access to Clerk internals.
 */

export type PipelineStatus =
  | "queued"
  | "extracting_audio"
  | "transcribing"
  | "analyzing"
  | "done"
  | "error";

export type PipelineStatusResponse = {
  jobId: string;
  status: PipelineStatus;
  stageLabel: string;
  progress: number;
  error?: string | null;
  updatedAt: string | null;
};

export type PipelineSegment = {
  start: number;
  end: number;
  text: string;
};

export type PipelineAnalysis = {
  title?: string;
  summary?: string;
  tags?: string[];
  topics?: string[];
  keyTakeaways?: string[];
  actionItems?: string[];
  notableInsights?: string[];
  qualityFlags?: string[];
  chapters?: { startSeconds: number; title: string; summary: string }[];
  steps?: {
    title: string;
    body: string;
    tags?: string[];
    keyStep?: boolean;
  }[];
};

export type PipelineResult = {
  id: string;
  status: PipelineStatus;
  originalFileName: string;
  title: string;
  transcript: string;
  transcriptSegments: PipelineSegment[];
  detectedLanguage?: string | null;
  analysis: PipelineAnalysis | null;
  summary?: string;
  tags?: string[];
  chapters?: PipelineAnalysis["chapters"];
  suggestions: {
    title?: string;
    topics?: string[];
    keyTakeaways?: string[];
    actionItems?: string[];
    notableInsights?: string[];
    qualityFlags?: string[];
    steps?: PipelineAnalysis["steps"];
  };
  videoR2Key?: string | null;
  audioR2Key?: string | null;
  isPublished?: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  error?: string | null;
};

const BASE = "/api/contributions";

export type GetToken = () => Promise<string | null>;

async function authHeaders(getToken: GetToken): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}

async function readErr(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.detail || j?.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function uploadContributionVideoToPipeline(
  file: File,
  title: string,
  getToken: GetToken,
): Promise<{ jobId: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("title", title);

  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    body: fd,
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error(await readErr(res));
  const data = await res.json();
  return { jobId: data.jobId as string };
}

export async function getContributionStatus(
  jobId: string,
  getToken: GetToken,
): Promise<PipelineStatusResponse> {
  const res = await fetch(`${BASE}/${jobId}/status`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error(await readErr(res));
  return (await res.json()) as PipelineStatusResponse;
}

export async function fetchContributionResult(
  jobId: string,
  getToken: GetToken,
): Promise<PipelineResult> {
  const res = await fetch(`${BASE}/${jobId}/result`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error(await readErr(res));
  return (await res.json()) as PipelineResult;
}

export async function publishContribution(
  jobId: string,
  getToken: GetToken,
): Promise<{ isPublished: boolean; publishedAt: string | null }> {
  const res = await fetch(`${BASE}/${jobId}/publish`, {
    method: "POST",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error(await readErr(res));
  return await res.json();
}

export type ProgressTick = (s: PipelineStatusResponse) => void;

export async function pollContributionStatus(
  jobId: string,
  getToken: GetToken,
  onProgress: ProgressTick,
  opts: { intervalMs?: number; signal?: AbortSignal } = {},
): Promise<PipelineStatusResponse> {
  const interval = opts.intervalMs ?? 1500;
  for (;;) {
    if (opts.signal?.aborted) {
      throw new DOMException("Polling aborted", "AbortError");
    }
    const s = await getContributionStatus(jobId, getToken);
    onProgress(s);
    if (s.status === "done" || s.status === "error") return s;
    await new Promise((r) => setTimeout(r, interval));
  }
}
