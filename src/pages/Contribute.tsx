import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CloudUpload,
  Pencil,
  FileVideo,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { StudioShell } from "@/components/studio/StudioShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addContribution, uploadContributionThumbnail, uploadContributionThumbnailFromUrl, uploadContributionVideo } from "@/data/contributionsStore";
import type { ContentEntry } from "@/data/content";
import type { ContentStep } from "@/data/content";
import {
  fetchContributionResult,
  pollContributionStatus,
  publishContribution,
  uploadContributionVideoToPipeline,
} from "@/data/contributionPipeline";
// Served from /public so the URL is stable across dev, prod, and persisted DB rows.
const thumbServer = "/thumbnails/thumb-server.png";
const thumbLaptop = "/thumbnails/thumb-laptop.png";
const thumbDashboard = "/thumbnails/thumb-dashboard.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type StepId = 0 | 1 | 2 | 3 | 4;

const steps = [
  { id: 0, label: "Resource basics" },
  { id: 1, label: "Processing" },
  { id: 2, label: "Transcript" },
  { id: 3, label: "Review" },
  { id: 4, label: "Done" },
] as const;

const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_BYTES = 500 * 1024 * 1024;

const THUMBNAIL_STYLES = [
  { id: "server", label: "Server", src: thumbServer },
  { id: "laptop", label: "Laptop", src: thumbLaptop },
  { id: "dashboard", label: "Dashboard", src: thumbDashboard },
] as const;

const CATEGORIES = [
  "AI",
  "Workflows",
  "Design",
  "Engineering",
  "Data",
  "Prompts",
  "Commerce",
  "Other",
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PreviewRow({
  label,
  value,
  onEdit,
  clamp,
  preserveLines,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  clamp?: boolean;
  preserveLines?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card/40 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "text-sm text-foreground",
            preserveLines && "whitespace-pre-line",
            clamp && "line-clamp-3",
          )}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
    </div>
  );
}

function Stepper({ current }: { current: StepId }) {
  return (
    <ol className="mx-auto flex w-full max-w-3xl items-start justify-between gap-2">
      {steps.map((s, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-3">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition",
                  isActive &&
                    "border-transparent bg-gradient-primary text-primary-foreground shadow-violet",
                  isDone &&
                    "border-primary/40 bg-primary/15 text-primary",
                  !isActive && !isDone && "border-border bg-card/60 text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-semibold",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2 mt-5 h-px flex-1 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const Contribute = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<StepId>(0);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);

  // AI suggested fields populated after processing
  const [aiTitle, setAiTitle] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [aiSteps, setAiSteps] = useState<ContentStep[]>([]);
  const [aiTranscript, setAiTranscript] = useState<string>("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [pipelineJobId, setPipelineJobId] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<
    { start: number; end: number; text: string }[]
  >([]);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("");

  // Step 1 — processing form fields
  const [thumbnailStyle, setThumbnailStyle] = useState<string>("server");
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);
  const [customThumbnailFile, setCustomThumbnailFile] = useState<File | null>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [processingDone, setProcessingDone] = useState(false);

  // Edit modal state
  type EditField =
    | "title"
    | "category"
    | "description"
    | "summary"
    | "steps"
    | "tags"
    | null;
  const [editing, setEditing] = useState<EditField>(null);

  // Local preview URL for the uploaded video
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Draft state used inside the edit modal
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftSteps, setDraftSteps] = useState("");
  const [draftTags, setDraftTags] = useState("");

  function openEdit(field: Exclude<EditField, null>) {
    setDraftTitle(aiTitle);
    setDraftCategory(category);
    setDraftDescription(description);
    setDraftSummary(aiSummary);
    setDraftSteps(JSON.stringify(aiSteps, null, 2));
    setDraftTags(aiTags.join(", "));
    setEditing(field);
  }

  function saveEdit() {
    if (editing === "title") setAiTitle(draftTitle);
    if (editing === "category") setCategory(draftCategory);
    if (editing === "description") setDescription(draftDescription);
    if (editing === "summary") setAiSummary(draftSummary);
    if (editing === "steps") {
      try {
        const parsed = JSON.parse(draftSteps);
        if (Array.isArray(parsed)) setAiSteps(parsed as ContentStep[]);
      } catch {
        // ignore invalid JSON, keep existing steps
      }
    }
    if (editing === "tags") {
      setAiTags(
        draftTags
          .split(",")
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean),
      );
    }
    setEditing(null);
  }

  function commitTagDraft(rawValue = tagDraft) {
    const nextTags = rawValue
      .split(/[,\s]+/)
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);

    if (nextTags.length > 0) {
      setAiTags((prev) => Array.from(new Set([...prev, ...nextTags])));
    }

    setTagDraft("");
  }

  const selectedThumb =
    customThumbnail ??
    THUMBNAIL_STYLES.find((s) => s.id === thumbnailStyle)?.src ??
    thumbServer;

  function handleFile(f: File | null) {
    if (!f) return;
    if (!ACCEPTED.includes(f.type) && !/\.(mp4|mov|webm)$/i.test(f.name)) {
      setError("Unsupported file. Please upload MP4, MOV or WebM.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("File exceeds 500 MB limit.");
      return;
    }
    setError(null);
    setFile(f);
  }

  async function startProcessing() {
    if (!file) return;
    setStep(1);
    setProgress(0);
    setProcessingDone(false);

    try {
      const { jobId } = await uploadContributionVideoToPipeline(file, title, getToken);
      setPipelineJobId(jobId);
      setProgress(8);

      const final = await pollContributionStatus(jobId, getToken, (s) => {
        if (typeof s.progress === "number") setProgress(s.progress);
      });

      if (final.status === "error") {
        toast.error("Processing failed", {
          description: final.error || "The video could not be processed.",
        });
        setProgress(0);
        return;
      }

      const result = await fetchContributionResult(jobId, getToken);

      const suggestedTitle =
        result.suggestions?.title?.trim() ||
        result.analysis?.title?.trim() ||
        title ||
        result.originalFileName.replace(/\.[^.]+$/, "");
      setAiTitle(suggestedTitle);

      setAiSummary(result.analysis?.summary || result.summary || "");

      const tags = result.analysis?.tags || result.tags || [];
      setAiTags(tags.map((t) => t.replace(/^#/, "").trim()).filter(Boolean));

      const steps: ContentStep[] = (result.analysis?.steps ||
        result.suggestions?.steps ||
        []
      ).map((s) => ({
        title: s.title,
        body: s.body,
        tags: s.tags ?? [],
        keyStep: Boolean(s.keyStep),
      }));
      setAiSteps(steps);

      setAiTranscript(result.transcript || "");
      setTranscriptSegments(
        (result.transcriptSegments ?? []).map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })),
      );
      setDetectedLanguage(result.detectedLanguage ?? "");

      if (result.error) {
        toast.warning("Analysis unavailable", {
          description: "Transcript ready — Gemini analysis could not be generated.",
        });
      }

      setProgress(100);
      setProcessingDone(true);
    } catch (err) {
      console.error("Contribution pipeline failed", err);
      toast.error("Processing failed", {
        description:
          err instanceof Error ? err.message : "The contribution backend is unavailable.",
      });
      setProgress(0);
    }
  }

  return (
    <StudioShell>
      <div className="space-y-10">
        <header className="space-y-3 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Welcome to your Studio
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground">
            Share what you know — upload a video, let Whisper transcribe and Gemini structure it,
            then review before publishing to the Hyvemind library.
          </p>
        </header>
        <Stepper current={step} />

      {/* STEP 0 — Resource basics */}
      {step === 0 && (
        <section className="neon-border neon-subtle space-y-8 p-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Upload a video</h2>
            <p className="text-sm text-muted-foreground">
              Share your knowledge with the team — Whisper will transcribe it, Gemini will analyse it.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-semibold text-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              required
              aria-required="true"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How to build an n8n workflow"
              className="w-full rounded-xl border border-primary/40 bg-background/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              The AI will suggest an improved title after processing.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Video File <span className="text-destructive">*</span>
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-16 text-center transition",
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/30 hover:border-foreground/40",
              )}
            >
              {file ? (
                <>
                  <FileVideo className="h-10 w-10 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </span>
                </>
              ) : (
                <>
                  <CloudUpload className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Click to select or drag & drop
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      MP4, MOV, WebM · max 500 MB
                    </p>
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </button>
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>

          <div className="flex items-center justify-center pt-2">
            <button
              type="button"
              disabled={!file || !title.trim()}
              onClick={startProcessing}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition",
                !file || !title.trim()
                  ? "cursor-not-allowed bg-primary/30 text-primary-foreground/60"
                  : "bg-gradient-primary text-primary-foreground shadow-violet hover:opacity-90",
              )}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 1 — Processing */}
      {step === 1 && (
        <section className="neon-border neon-subtle space-y-8 p-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Processing your video</h2>
            <p className="text-sm text-muted-foreground">
              While the AI works, choose a thumbnail and add the final details.
            </p>
          </div>

          {/* Compact processing banner */}
          <div className="space-y-4 rounded-xl border border-border bg-background/30 p-6">
            <div className="flex items-center gap-4">
              {processingDone ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-5 w-5" />
                </div>
              ) : (
                <Loader2 className="h-9 w-9 shrink-0 animate-spin text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">
                  {processingDone ? "Processing complete" : "Processing your video…"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {processingDone
                    ? "Add the final details below, then continue to review."
                    : "Extracting key steps and generating summary"}
                </p>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full bg-gradient-neon transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Thumbnail picker */}
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h3 className="text-base font-semibold text-foreground">Thumbnail</h3>
              <p className="text-sm text-muted-foreground">Choose a style or upload your own</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {THUMBNAIL_STYLES.map((s) => {
                const isSelected = !customThumbnail && thumbnailStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setThumbnailStyle(s.id);
                      setCustomThumbnail(null);
                      setCustomThumbnailFile(null);
                    }}
                    className={cn(
                      "relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl transition",
                      isSelected
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "ring-1 ring-transparent hover:ring-foreground/20",
                    )}
                  >
                    <img
                      src={s.src}
                      alt={`${s.label} thumbnail`}
                      className="h-full w-full object-cover"
                    />
                    {isSelected && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {customThumbnail && (
              <div className="relative w-fit overflow-hidden rounded-2xl ring-2 ring-primary">
                <img
                  src={customThumbnail}
                  alt="Custom thumbnail"
                  className="h-32 w-auto object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomThumbnail(null);
                    setCustomThumbnailFile(null);
                  }}
                  aria-label="Remove custom thumbnail"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => thumbRef.current?.click()}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:opacity-80"
            >
              <Upload className="h-4 w-4" />
              Upload your own thumbnail
            </button>
            <input
              ref={thumbRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setCustomThumbnail(URL.createObjectURL(f));
                  setCustomThumbnailFile(f);
                }
              }}
            />
          </div>

          {/* Details */}
          <div className="space-y-5">
            <h3 className="text-base font-semibold text-foreground">Details</h3>

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-foreground">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                id="category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/40 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will people learn from this?"
                className="w-full rounded-xl border border-border bg-background/40 px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              disabled={!processingDone || !category}
              onClick={() => setStep(2)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition",
                !processingDone || !category
                  ? "cursor-not-allowed bg-primary/30 text-primary-foreground/60"
                  : "bg-gradient-primary text-primary-foreground shadow-violet hover:opacity-90",
              )}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 2 — Transcript */}
      {step === 2 && (
        <section className="neon-border neon-subtle space-y-8 p-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Transcript &amp; insights</h2>
            <p className="text-sm text-muted-foreground">
              Here&apos;s what the AI heard and structured from your video.
            </p>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="transcript-summary"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Video transcription summary
            </label>
            <textarea
              id="transcript-summary"
              rows={5}
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              placeholder="Generating summary…"
              className="w-full rounded-xl border border-border bg-card/40 p-5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step-by-step summary
              </p>
              <button
                type="button"
                onClick={() =>
                  setAiSteps((prev) => [
                    ...prev,
                    { title: "New step", body: "Describe this step…", tags: [] },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Add step
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              {aiSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Generating steps…</p>
              ) : (
                <ol className="divide-y divide-border/50">
                  {aiSteps.map((s, i) => (
                    <li key={i} className="space-y-3 py-5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                            STEP {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAiSteps((prev) =>
                                prev.map((p, idx) =>
                                  idx === i ? { ...p, keyStep: !p.keyStep } : p,
                                ),
                              )
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition",
                              s.keyStep
                                ? "border-neon-pink/60 text-neon-pink"
                                : "border-border/60 text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {s.keyStep ? "KEY STEP" : "Mark key"}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAiSteps((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          aria-label={`Remove step ${i + 1}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        value={s.title}
                        onChange={(e) =>
                          setAiSteps((prev) =>
                            prev.map((p, idx) =>
                              idx === i ? { ...p, title: e.target.value } : p,
                            ),
                          )
                        }
                        placeholder="Step title"
                        className="w-full rounded-lg border border-transparent bg-transparent text-base font-bold leading-snug text-foreground transition hover:border-border/60 focus:border-primary focus:bg-background/40 focus:px-3 focus:py-2 focus:outline-none"
                      />
                      <textarea
                        value={s.body}
                        rows={3}
                        onChange={(e) =>
                          setAiSteps((prev) =>
                            prev.map((p, idx) =>
                              idx === i ? { ...p, body: e.target.value } : p,
                            ),
                          )
                        }
                        placeholder="Describe this step…"
                        className="w-full rounded-lg border border-transparent bg-transparent text-sm leading-relaxed text-muted-foreground transition hover:border-border/60 focus:border-primary focus:bg-background/40 focus:px-3 focus:py-2 focus:text-foreground focus:outline-none"
                      />
                      <input
                        value={(s.tags ?? []).join(", ")}
                        onChange={(e) =>
                          setAiSteps((prev) =>
                            prev.map((p, idx) =>
                              idx === i
                                ? {
                                    ...p,
                                    tags: e.target.value
                                      .split(",")
                                      .map((t) => t.trim())
                                      .filter(Boolean),
                                  }
                                : p,
                            ),
                          )
                        }
                        placeholder="Comma-separated tags"
                        className="w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 font-mono text-[11px] text-muted-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                      />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tags
            </p>
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex flex-wrap gap-2">
                {aiTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs text-muted-foreground"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() =>
                        setAiTags((prev) => prev.filter((tag) => tag !== t))
                      }
                      aria-label={`Remove tag ${t}`}
                      className="text-muted-foreground/70 transition hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagDraft}
                  placeholder={aiTags.length === 0 ? "Add a tag and press Enter" : "Add tag…"}
                  onChange={(e) => setTagDraft(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      commitTagDraft(e.currentTarget.value);
                    } else if (
                      e.key === "Backspace" &&
                      tagDraft === "" &&
                      aiTags.length > 0
                    ) {
                      setAiTags((prev) => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => commitTagDraft()}
                  className="min-w-[140px] flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or comma to add a tag. Click ✕ to remove.
            </p>
          </div>

          <Collapsible
            open={transcriptOpen}
            onOpenChange={setTranscriptOpen}
            className="space-y-3"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card/40 px-5 py-4 text-left transition hover:border-foreground/30">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Raw transcription</p>
                <p className="text-xs text-muted-foreground">
                  {transcriptOpen ? "Click to hide the full transcript" : "Click to view the full transcript"}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  transcriptOpen && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="max-h-96 overflow-y-auto whitespace-pre-line rounded-xl border border-border bg-background/40 p-5 text-sm leading-relaxed text-foreground">
                {aiTranscript || "No transcript available."}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-violet transition hover:opacity-90"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 3 — Review */}
      {step === 3 && (
        <section className="neon-border neon-subtle space-y-8 p-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Review & publish</h2>
            <p className="text-sm text-muted-foreground">
              This is a read-only preview of your resource. Go back to make changes.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Video preview
            </p>
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              {videoPreviewUrl ? (
                <video src={videoPreviewUrl} controls className="aspect-video w-full" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-xs text-muted-foreground">
                  No video uploaded
                </div>
              )}
            </div>
          </div>

          {/* Basics */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Title
              </p>
              <p className="mt-1 text-sm text-foreground">
                {aiTitle || title || "Untitled"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </p>
              <p className="mt-1 text-sm text-foreground">{category || "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                {description || "No description yet"}
              </p>
            </div>
          </div>

          {/* CORE_INTEL // DETAILED_SUMMARY card */}
          <div className="neon-border neon-subtle space-y-8 rounded-2xl p-6 md:p-8">
            <div className="space-y-4">
              <p className="font-mono text-xs tracking-[0.25em] text-primary">
                CORE_INTEL <span className="text-muted-foreground/70">// DETAILED_SUMMARY</span>
              </p>
              <p className="text-base leading-relaxed text-foreground">
                {aiSummary || "No summary yet."}
              </p>
              {aiTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {aiTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs text-muted-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1 pt-2">
              <h3 className="text-xl font-bold text-foreground">Step by step</h3>
              <p className="text-sm text-muted-foreground">
                A walkthrough of what's covered in this resource.
              </p>
            </div>

            {aiSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No steps yet.</p>
            ) : (
              <ol className="divide-y divide-border/60">
                {aiSteps.map((s, i) => (
                  <li key={i} className="space-y-3 py-6 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-xs tracking-[0.25em] text-primary">
                        STEP {i + 1}
                      </p>
                      {s.keyStep && (
                        <span className="inline-flex items-center rounded-full border border-primary/60 px-2.5 py-0.5 font-mono text-[10px] tracking-[0.2em] text-primary">
                          KEY STEP
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-bold leading-snug text-foreground">
                      {s.title}
                    </h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {s.body}
                    </p>
                    {(s.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(s.tags ?? []).map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full border border-border/70 bg-background/40 px-2.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={async () => {
                try {
                  // Prefer R2 (already uploaded by the backend pipeline) over
                  // Supabase Storage to avoid the 50MB free-tier object cap.
                  // Only fall back to Supabase upload if there's no pipeline job.
                  const videoUrl = pipelineJobId
                    ? `r2:${pipelineJobId}`
                    : file
                      ? await uploadContributionVideo(file)
                      : undefined;
                  const thumbnail = customThumbnailFile
                    ? await uploadContributionThumbnail(customThumbnailFile)
                    : await uploadContributionThumbnailFromUrl(selectedThumb);
                  const entry: ContentEntry = {
                    type: (category || aiTags[0] || "COMMUNITY").toUpperCase(),
                    icon: "video",
                    title: aiTitle.trim() || title.trim() || "Untitled resource",
                    author: "You",
                    duration: "—",
                    submittedAt: new Date().toISOString(),
                    glow: "violet",
                    views: 0,
                    likes: 0,
                    xp: 10,
                    description: description || aiSummary,
                    tags: aiTags,
                    summary: description || aiSummary,
                    steps: aiSteps,
                    videoUrl,
                    thumbnail,
                    transcript: aiTranscript || undefined,
                    transcriptSegments:
                      transcriptSegments.length > 0 ? transcriptSegments : undefined,
                    detectedLanguage: detectedLanguage || undefined,
                  };
                  // Mark Neon row as published FIRST so the public R2 video
                  // endpoint succeeds the instant the Supabase row appears.
                  if (pipelineJobId) {
                    try {
                      await publishContribution(pipelineJobId, getToken);
                    } catch (publishErr) {
                      console.warn("Pipeline publish flag failed", publishErr);
                    }
                  }

                  await addContribution(entry);

                  setStep(4);
                  toast.success("+3 AwardCo Credits Earned", {
                    description: "Keep contributing to level up",
                    duration: 4000,
                  });
                } catch (err) {
                  console.error("Publish failed", err);
                  toast.error("Publish failed", {
                    description: err instanceof Error ? err.message : "Please try again.",
                  });
                }
              }}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-violet transition hover:opacity-90"
            >
              Publish resource
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-16 text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.6)]">
              <Check className="h-14 w-14 text-white" strokeWidth={3} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-foreground">Resource submitted!</h2>
            <p className="text-base text-muted-foreground">
              It's now live in the feed for your team to discover.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-violet transition hover:opacity-90"
            >
              View in feed
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setStep(0);
                setTitle("");
                setFile(null);
                setError(null);
                setProgress(0);
                setAiTitle("");
                setAiSummary("");
                setAiTags([]);
                setTagDraft("");
                setAiSteps([]);
                setAiTranscript("");
                setTranscriptOpen(false);
                setThumbnailStyle("server");
                setCustomThumbnail(null);
                setCustomThumbnailFile(null);
                setCategory("");
                setDescription("");
                setProcessingDone(false);
                setPipelineJobId(null);
                setTranscriptSegments([]);
                setDetectedLanguage("");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-6 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Submit another
            </button>
          </div>
        </section>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit details</DialogTitle>
            <DialogDescription>
              Update the fields below. Changes apply to the preview when you save.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editing === "summary" && (
              <div className="space-y-2">
              <Label htmlFor="edit-summary">AI generated summary</Label>
              <Textarea
                id="edit-summary"
                rows={5}
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
              />
              </div>
            )}
            {editing === "steps" && (
              <div className="space-y-2">
              <Label htmlFor="edit-steps">Step-by-step process summary</Label>
              <Textarea
                id="edit-steps"
                rows={7}
                value={draftSteps}
                onChange={(e) => setDraftSteps(e.target.value)}
              />
              </div>
            )}
            {editing === "tags" && (
              <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="workflows, automation, n8n"
              />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editing === "summary") setAiSummary(draftSummary);
                if (editing === "steps") {
                  try {
                    const parsed = JSON.parse(draftSteps);
                    if (Array.isArray(parsed)) setAiSteps(parsed as ContentStep[]);
                  } catch {
                    // ignore invalid JSON, keep existing steps
                  }
                }
                if (editing === "tags") {
                  setAiTags(
                    draftTags
                      .split(",")
                      .map((t) => t.trim().replace(/^#/, ""))
                      .filter(Boolean),
                  );
                }
                setEditing(null);
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </StudioShell>
  );
};

export default Contribute;