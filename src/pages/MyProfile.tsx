import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { PageShell } from "@/components/dashboard/PageShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SKILL_OPTIONS = [
  "Figma",
  "Tokens",
  "Tailwind",
  "LangGraph",
  "Agents",
  "Prompting",
  "Kafka",
  "ClickHouse",
  "Dashboards",
  "Edge",
  "Auth",
  "APIs",
  "Commerce",
  "Copy",
  "Pricing",
  "n8n",
  "Zapier",
  "Ops",
  "Motion",
  "3D",
  "Branding",
];

type SkillBucket = "expert_skills" | "intermediate_skills" | "beginner_skills";

type ProfileForm = {
  display_name: string;
  email: string;
  job_title: string;
  team: string;
  bio: string;
  avatar_url: string | null;
  expert_skills: string[];
  intermediate_skills: string[];
  beginner_skills: string[];
};

const empty: ProfileForm = {
  display_name: "",
  email: "",
  job_title: "",
  team: "",
  bio: "",
  avatar_url: null,
  expert_skills: [],
  intermediate_skills: [],
  beginner_skills: [],
};

const MyProfile = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!auth.user) {
        setLoading(false);
        return;
      }
      setUserId(auth.user.id);
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      setForm({
        display_name: existing?.display_name ?? "",
        email: auth.user.email ?? existing?.email ?? "",
        job_title: existing?.job_title ?? "",
        team: existing?.team ?? "",
        bio: existing?.bio ?? "",
        avatar_url: existing?.avatar_url ?? null,
        expert_skills: existing?.expert_skills ?? [],
        intermediate_skills: existing?.intermediate_skills ?? [],
        beginner_skills: existing?.beginner_skills ?? [],
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const bucketLabel = (b: SkillBucket) =>
    b === "expert_skills" ? "Expert" : b === "intermediate_skills" ? "Intermediate" : "Beginner";

  const toggleSkill = (bucket: SkillBucket, skill: string) => {
    setForm((f) => {
      const current = new Set(f[bucket]);
      const wasInBucket = current.has(skill);
      if (wasInBucket) current.delete(skill);
      else current.add(skill);
      // Skill is exclusive to one bucket — remove from the other two.
      const others: SkillBucket[] = (
        ["expert_skills", "intermediate_skills", "beginner_skills"] as SkillBucket[]
      ).filter((b) => b !== bucket);
      const next = { ...f, [bucket]: Array.from(current) };
      let movedFrom: SkillBucket | null = null;
      for (const b of others) {
        if (f[b].includes(skill)) movedFrom = b;
        next[b] = f[b].filter((s) => s !== skill);
      }
      if (!wasInBucket && movedFrom) {
        toast({
          title: `Moved “${skill}”`,
          description: `${bucketLabel(movedFrom)} → ${bucketLabel(bucket)}`,
        });
      }
      return next;
    });
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleUpload = async (file: File) => {
    if (!userId) {
      toast({ title: "Sign in required", description: "Please sign in to upload a photo.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setField("avatar_url", pub.publicUrl);
      toast({ title: "Photo uploaded", description: "Don't forget to save your profile." });
    } catch (err) {
      console.error(err);
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        display_name: form.display_name || null,
        email: form.email || null,
        job_title: form.job_title || null,
        team: form.team || null,
        bio: form.bio || null,
        avatar_url: form.avatar_url,
        expert_skills: form.expert_skills,
        intermediate_skills: form.intermediate_skills,
        beginner_skills: form.beginner_skills,
      };
      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Profile saved" });
    } catch (err) {
      console.error(err);
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      eyebrow="ACCOUNT // PROFILE"
      title="My Profile"
      description="Your public profile in the directory. Add Expert Skills to appear on Find Experts."
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading profile…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Photo card — same proportion as Expert cards (3/4 aspect) */}
          <div className="space-y-3">
            <PhotoUpload
              value={form.avatar_url}
              uploading={uploading}
              onPick={handlePickFile}
              onClear={() => setField("avatar_url", null)}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            <p className="px-1 text-xs text-muted-foreground">
              JPG or PNG. Square framing recommended — this card matches the Find Experts grid.
            </p>
          </div>

          {/* Fields */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Display name">
                <Input
                  value={form.display_name}
                  onChange={(e) => setField("display_name", e.target.value)}
                  placeholder="e.g. Aanya Sharma"
                />
              </Field>
              <Field label="Email" hint="Pulled from your account">
                <Input value={form.email} disabled readOnly />
              </Field>
              <Field label="Job title">
                <Input
                  value={form.job_title}
                  onChange={(e) => setField("job_title", e.target.value)}
                  placeholder="e.g. Sr. Motion Designer"
                />
              </Field>
              <Field label="Team">
                <Input
                  value={form.team}
                  onChange={(e) => setField("team", e.target.value)}
                  placeholder="e.g. Design"
                />
              </Field>
            </div>

            <SkillSelector
              label="Expert Skills"
              sublabel="I teach"
              accent="primary"
              selected={form.expert_skills}
              onToggle={(s) => toggleSkill("expert_skills", s)}
            />
            <SkillSelector
              label="Intermediate Skills"
              sublabel="I use"
              accent="glow"
              selected={form.intermediate_skills}
              onToggle={(s) => toggleSkill("intermediate_skills", s)}
            />
            <SkillSelector
              label="Beginner Skills"
              sublabel="I am learning"
              accent="muted"
              selected={form.beginner_skills}
              onToggle={(s) => toggleSkill("beginner_skills", s)}
            />

            <Field label="Bio">
              <Textarea
                rows={4}
                value={form.bio}
                onChange={(e) => setField("bio", e.target.value)}
                placeholder="A short intro that shows up on your expert profile."
              />
            </Field>

            <div className="flex items-center justify-end pt-2">
              <Button
                size="lg"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-gradient-primary px-6 font-semibold text-primary-foreground shadow-violet"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {hint && <span className="text-[10px] uppercase tracking-wider opacity-70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function PhotoUpload({
  value,
  uploading,
  onPick,
  onClear,
}: {
  value: string | null;
  uploading: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] p-[2px] [background:linear-gradient(180deg,hsl(var(--primary-glow))_0%,hsl(var(--primary))_100%)]">
      <button
        type="button"
        onClick={onPick}
        className="group relative block w-full overflow-hidden rounded-[calc(2rem-2px)] bg-card"
        aria-label={value ? "Replace profile photo" : "Upload profile photo"}
      >
        <div className="relative aspect-[3/4] w-full">
          {value ? (
            <img
              src={value}
              alt="Profile"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-card text-muted-foreground transition group-hover:text-foreground">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background/50">
                <Camera className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold">Upload photo</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-foreground" />
            </div>
          )}
        </div>
      </button>
      {value && !uploading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
          aria-label="Remove photo"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SkillSelector({
  label,
  sublabel,
  selected,
  onToggle,
  accent,
}: {
  label: string;
  sublabel: string;
  selected: string[];
  onToggle: (s: string) => void;
  accent: "primary" | "glow" | "muted";
}) {
  const activeStyles = {
    primary: "border-primary bg-primary text-primary-foreground",
    glow: "border-primary-glow bg-primary-glow/15 text-primary-glow",
    muted: "border-foreground/40 bg-foreground/10 text-foreground",
  }[accent];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {label} <span className="ml-1 text-xs font-normal text-muted-foreground">({sublabel})</span>
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {selected.length} selected
        </span>
      </div>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card/40 p-3">
        {SKILL_OPTIONS.map((s) => {
          const active = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? activeStyles
                  : "border-border bg-background/40 text-foreground/70 hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MyProfile;
