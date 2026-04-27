import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRight, Users, GripVertical, Loader2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ItchStatus = "open" | "exploring" | "in_progress" | "solved";

type Itch = {
  id: string;
  title: string;
  description: string | null;
  team: string;
  submitted_by: string;
  status: ItchStatus;
  created_at: string;
};

const COLUMNS: { id: ItchStatus; label: string; accent: string }[] = [
  { id: "open", label: "Open", accent: "from-sky-400/80 to-blue-500/80" },
  { id: "exploring", label: "Exploring", accent: "from-violet-400/80 to-fuchsia-500/80" },
  { id: "in_progress", label: "In Progress", accent: "from-amber-400/80 to-orange-500/80" },
  { id: "solved", label: "Solved", accent: "from-emerald-400/80 to-teal-500/80" },
];

const FixTheItch = () => {
  const [itches, setItches] = useState<Itch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<ItchStatus | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTeam, setFormTeam] = useState("");

  // Initial fetch
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("itches")
        .select("*")
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) {
        toast.error("Couldn't load the board");
      } else if (data) {
        setItches(data as Itch[]);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("itches-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itches" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Itch;
            setItches((prev) => (prev.find((i) => i.id === row.id) ? prev : [row, ...prev]));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Itch;
            setItches((prev) => prev.map((i) => (i.id === row.id ? row : i)));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as Itch;
            setItches((prev) => prev.filter((i) => i.id !== row.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    const team = formTeam.trim();
    if (!title || !team) {
      toast.error("Title and team are required");
      return;
    }
    if (title.length > 140 || team.length > 60 || formDescription.length > 500) {
      toast.error("Please shorten your input");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("itches").insert({
      title,
      description: formDescription.trim() || null,
      team,
      submitted_by: "You",
      status: "open",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't submit your itch");
      return;
    }
    toast.success("Itch posted to the Open column");
    setFormTitle("");
    setFormDescription("");
    setFormTeam("");
    setDialogOpen(false);
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, status: ItchStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = async (e: DragEvent<HTMLDivElement>, status: ItchStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const current = itches.find((i) => i.id === id);
    if (!current || current.status === status) return;

    // Optimistic update
    setItches((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    const { error } = await supabase.from("itches").update({ status }).eq("id", id);
    if (error) {
      toast.error("Couldn't move card");
      // Rollback
      setItches((prev) => prev.map((i) => (i.id === id ? { ...i, status: current.status } : i)));
    }
  };

  const cardsByColumn = (status: ItchStatus) =>
    itches.filter((i) => i.status === status);

  return (
    <PageShell
      eyebrow="FIX_THE_ITCH // PRIVATE_BETA"
      title="The Itch Board"
      description="Drop a problem. Drag it across columns as it moves from open to solved. When you've cracked it, share the fix."
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          live board · {itches.length} {itches.length === 1 ? "itch" : "itches"}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-gradient-primary px-5 text-sm font-semibold shadow-violet hover:opacity-90">
              <Plus className="h-4 w-4" />
              Submit an itch
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit an itch</DialogTitle>
              <DialogDescription>
                Tell us what's bugging you. It'll land in the Open column instantly.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="itch-title">Problem title</Label>
                <Input
                  id="itch-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Sidebar collapses on route change"
                  maxLength={140}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itch-desc">Short description</Label>
                <Textarea
                  id="itch-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What's happening, where, and how often?"
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itch-team">Team it affects</Label>
                <Input
                  id="itch-team"
                  value={formTeam}
                  onChange={(e) => setFormTeam(e.target.value)}
                  placeholder="e.g. Frontend, Design, Platform"
                  maxLength={60}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="bg-gradient-primary">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Post to board
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = cardsByColumn(col.id);
          const isOver = dragOverColumn === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={cn(
                "flex min-h-[60vh] flex-col rounded-2xl border border-border bg-card/40 p-3 transition-colors",
                isOver && "border-primary/60 bg-primary/5",
              )}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full bg-gradient-to-br", col.accent)} />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    {col.label}
                  </h2>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono text-muted-foreground">
                  {cards.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
                {loading && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                {!loading && cards.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
                    Drop a card here
                  </div>
                )}
                {cards.map((card) => (
                  <ItchCard
                    key={card.id}
                    itch={card}
                    onDragStart={(e) => handleDragStart(e, card.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
};

function ItchCard({
  itch,
  onDragStart,
}: {
  itch: Itch;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
}) {
  const isSolved = itch.status === "solved";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "group cursor-grab rounded-xl border border-border bg-card p-3.5 shadow-card transition-all hover:border-primary/40 hover:shadow-violet active:cursor-grabbing",
        isSolved && "border-emerald-500/30",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-foreground">{itch.title}</h3>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {itch.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {itch.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
          <Users className="h-3 w-3" />
          {itch.team}
        </span>
        <span className="text-muted-foreground/70">· by {itch.submitted_by}</span>
      </div>

      {isSolved && (
        <Link
          to="/studio/contribute"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:from-emerald-500/30 hover:to-teal-500/30"
        >
          Share your solution
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export default FixTheItch;
