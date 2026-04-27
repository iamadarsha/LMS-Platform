import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { StudioShell } from "@/components/studio/StudioShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteContribution, useContributions } from "@/data/contributionsStore";
import type { ContentEntry } from "@/data/content";
import { toast } from "sonner";

function formatDate(value?: string) {
  if (!value) return "Today";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

const UNDO_WINDOW_MS = 5000;

const StudioDashboard = () => {
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ContentEntry | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const { items: contributions } = useContributions();

  const visibleContributions = useMemo(() => {
    if (hiddenIds.size === 0) return contributions;
    return contributions.filter((c) => !c.id || !hiddenIds.has(c.id));
  }, [contributions, hiddenIds]);

  const filteredResources = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return visibleContributions;
    return visibleContributions.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.type.toLowerCase().includes(needle),
    );
  }, [visibleContributions, query]);

  const showWithUndo = (entry: ContentEntry) => {
    if (!entry.id) {
      // Anonymous entries — fall back to immediate hard delete.
      void deleteContribution(entry);
      toast.success("Resource deleted");
      return;
    }
    const id = entry.id;

    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const timer = setTimeout(() => {
      pendingTimers.current.delete(id);
      void (async () => {
        try {
          await deleteContribution(entry);
        } catch (err) {
          toast.error("Failed to delete resource", {
            description: err instanceof Error ? err.message : "Please try again.",
          });
          // Re-show the row if the actual delete failed.
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })();
    }, UNDO_WINDOW_MS);

    pendingTimers.current.set(id, timer);

    toast(`“${entry.title}” deleted`, {
      description: "Removed from your library.",
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          const t = pendingTimers.current.get(id);
          if (t) {
            clearTimeout(t);
            pendingTimers.current.delete(id);
          }
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          toast.success("Restored", { description: entry.title });
        },
      },
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    showWithUndo(target);
  };

  return (
    <StudioShell>
      <section className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Contributor Dashboard</h1>
          <p className="text-sm text-muted-foreground md:text-base">Manage your shared knowledge resources</p>
        </div>

        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your resources..."
            className="h-12 border-border/70 bg-background/70 pl-10 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="w-full overflow-hidden border-y border-border/70">
          <Table>
            <TableHeader>
              <TableRow className="border-border/70 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Resource</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Views</TableHead>
                <TableHead className="text-muted-foreground">XP</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((item, index) => (
                <TableRow key={`${item.title}-${index}`} className="border-border/60 hover:bg-muted/30">
                  <TableCell className="max-w-[420px] py-5 text-sm font-medium text-foreground">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="border border-border/60 bg-secondary/80 text-secondary-foreground">
                      {item.icon === "tutorial" ? "Tutorial" : "Video"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(item.submittedAt)}</TableCell>
                  <TableCell className="text-sm text-foreground">{item.views ?? 0}</TableCell>
                  <TableCell className="text-sm font-semibold text-primary">+{item.xp ?? 10}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(item)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {filteredResources.length === 0 && (
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    No contributed resources found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
            <AlertDialogDescription>
              The resource will be removed from your library. You'll have 5 seconds to undo before
              it's permanently deleted (along with its views, saves and XP).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StudioShell>
  );
};

export default StudioDashboard;