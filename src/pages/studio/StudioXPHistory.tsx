import { useMemo } from "react";
import { Award, Eye, Heart, Trophy, Flame, CheckCircle2, Upload, PlayCircle } from "lucide-react";
import { StudioShell } from "@/components/studio/StudioShell";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useContributions } from "@/data/contributionsStore";
import { cn } from "@/lib/utils";

const XP_PER_LIKE = 2;
const XP_PER_PUBLISH = 25;

const earnRules = [
  { icon: PlayCircle, label: "View a resource", xp: 5 },
  { icon: CheckCircle2, label: "Complete a resource", xp: 10 },
  { icon: Upload, label: "Submit a resource", xp: 25 },
  { icon: Trophy, label: "First submission bonus", xp: 50 },
  { icon: Flame, label: "Daily streak", xp: 15 },
];

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type LogRow = {
  id: string;
  title: string;
  date?: string;
  views: number;
  likes: number;
  xpFromLikes: number;
  xpForPublishing: number;
  totalXp: number;
  deleted: boolean;
};

const StudioXPHistory = () => {
  const { items: contributions } = useContributions();

  const rows: LogRow[] = useMemo(
    () =>
      contributions.map((c) => {
        const deleted = false; // future: derive from status when soft-delete is added
        const views = c.views ?? 0;
        const likes = c.likes ?? 0;
        const xpFromLikes = likes * XP_PER_LIKE;
        const xpForPublishing = XP_PER_PUBLISH;
        const totalXp = xpFromLikes + xpForPublishing;
        const sign = deleted ? -1 : 1;
        return {
          id: c.id ?? c.title,
          title: c.title,
          date: c.submittedAt,
          views,
          likes,
          xpFromLikes: xpFromLikes * sign,
          xpForPublishing: xpForPublishing * sign,
          totalXp: totalXp * sign,
          deleted,
        };
      }),
    [contributions],
  );

  const totalXp = useMemo(() => rows.reduce((sum, r) => sum + r.totalXp, 0), [rows]);

  return (
    <StudioShell>
      <div className="space-y-10">
        {/* Heading */}
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">XP History</h1>
          <p className="text-base text-muted-foreground">Your experience points breakdown</p>
        </header>

        {/* Total XP stat card */}
        <Card className="overflow-hidden border-border/60 bg-gradient-primary text-primary-foreground shadow-violet">
          <CardContent className="flex items-center justify-between gap-6 p-8">
            <div className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80">
                Total XP Earned
              </p>
              <p className="text-6xl font-bold tabular-nums">{totalXp.toLocaleString()}</p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-foreground/15 backdrop-blur">
              <Award className="h-10 w-10" />
            </div>
          </CardContent>
        </Card>

        {/* Activity Log */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Activity Log</h2>
          <Card className="border-border/60 bg-card/50">
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No activity yet. Submit your first resource to start earning XP.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider">Resource Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">Views</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">Likes</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">XP from Likes</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">XP for Publishing</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">Total XP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const negative = row.deleted;
                      const xpClass = negative ? "text-destructive" : "text-foreground";
                      return (
                        <TableRow key={row.id} className="border-border/60">
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <span className={cn(negative && "line-through text-muted-foreground")}>
                                {row.title}
                              </span>
                              {negative && (
                                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                                  Deleted
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(row.date)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            <span className="inline-flex items-center justify-end gap-1.5">
                              <Eye className="h-3.5 w-3.5" />
                              {row.views.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            <span className="inline-flex items-center justify-end gap-1.5">
                              <Heart className="h-3.5 w-3.5" />
                              {row.likes.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums font-medium", xpClass)}>
                            {negative ? "" : "+"}
                            {row.xpFromLikes} XP
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums font-medium", xpClass)}>
                            {negative ? "" : "+"}
                            {row.xpForPublishing} XP
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums font-bold",
                              negative ? "text-destructive" : "text-primary",
                            )}
                          >
                            {negative ? "" : "+"}
                            {row.totalXp} XP
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        {/* How to Earn XP */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">How to Earn XP</h2>
          <Card className="border-border/60 bg-card/50">
            <CardContent className="divide-y divide-border/60 p-0">
              {earnRules.map((rule) => {
                const Icon = rule.icon;
                return (
                  <div key={rule.label} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{rule.label}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-primary">+{rule.xp} XP</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </div>
    </StudioShell>
  );
};

export default StudioXPHistory;
