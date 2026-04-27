import { Plus, Library, Search, ChevronLeft, ChevronRight, UserCircle2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/dashboard/PageShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import creativeDirectorImg from "@/assets/experts/creative-director.png";
import daveImg from "@/assets/experts/dave.png";
import annieImg from "@/assets/experts/annie.png";
import samirImg from "@/assets/experts/samir.png";
import elenaImg from "@/assets/experts/elena.png";
import noahImg from "@/assets/experts/noah.jpg";

type Expert = {
  name: string;
  role: string;
  category: string;
  skills: string[];
  resources: number;
  image: string | null;
};

const experts: Expert[] = [
  {
    name: "Jane Okland",
    role: "Ass. Creative Director",
    category: "Design",
    skills: ["LangGraph", "Agents", "Prompting"],
    resources: 24,
    image: creativeDirectorImg,
  },
  {
    name: "Dave Shaw",
    role: "Ass. Creative Director",
    category: "Design",
    skills: ["Figma", "Tokens", "Tailwind"],
    resources: 18,
    image: daveImg,
  },
  {
    name: "Annie Batman",
    role: "Art Director",
    category: "Design",
    skills: ["Kafka", "ClickHouse", "Dashboards"],
    resources: 31,
    image: annieImg,
  },
  {
    name: "Danielle Croxton",
    role: "Sr. Creative Project Manager",
    category: "CPM",
    skills: ["Edge", "Auth", "APIs"],
    resources: 15,
    image: samirImg,
  },
  {
    name: "Gowtham S",
    role: "Sr. Motion Designer",
    category: "3D Team",
    skills: ["Commerce", "Copy", "Pricing"],
    resources: 22,
    image: elenaImg,
  },
  {
    name: "Noah Becker",
    role: "Automation Engineer",
    category: "Automation",
    skills: ["n8n", "Zapier", "Ops"],
    resources: 12,
    image: noahImg,
  },
];

const CATEGORIES = [
  "All",
  "Design",
  "Engineering",
  "AI & Automation",
  "Data",
  "Growth",
  "CPM",
  "3D Team",
];

const SPECIALISATIONS = [
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

const FindExperts = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSpecs, setActiveSpecs] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [profileExperts, setProfileExperts] = useState<Expert[]>([]);
  const [openExpert, setOpenExpert] = useState<Expert | null>(null);
  const tagsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, job_title, team, avatar_url, expert_skills")
        .not("expert_skills", "is", null);
      if (cancelled || error || !data) return;
      const mapped: Expert[] = data
        .filter((p) => Array.isArray(p.expert_skills) && p.expert_skills.length > 0)
        .map((p) => ({
          name: p.display_name || "Unnamed",
          role: p.job_title || "Contributor",
          category: p.team || "Team",
          skills: p.expert_skills as string[],
          resources: 0,
          image: p.avatar_url,
        }));
      setProfileExperts(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollTags = (dir: "left" | "right") => {
    const el = tagsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  };

  const toggleSpec = (s: string) =>
    setActiveSpecs((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const allExperts = [...profileExperts, ...experts];

  const filtered = allExperts.filter((e) => {
    const matchCat = activeCategory === "All" || e.category === activeCategory;
    const q = query.trim().toLowerCase();
    const matchQuery =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      e.skills.some((s) => s.toLowerCase().includes(q));
    const matchSpec =
      activeSpecs.length === 0 || activeSpecs.some((s) => e.skills.includes(s));
    return matchCat && matchQuery && matchSpec;
  });

  return (
    <PageShell
      eyebrow="EXPERTS // DIRECTORY"
      title="Find an expert"
      description="Connect with vetted practitioners who help you ship faster."
    >
      {/* Search bar */}
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, role, or skill…"
          className="h-12 rounded-full border-border bg-card pl-11 pr-4 text-sm"
        />
      </div>

      {/* Category row */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const active = activeCategory === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/80 hover:border-primary/60 hover:text-foreground"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Specialisation tags with horizontal scroll arrows */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scroll specialisations left"
          onClick={() => scrollTags("left")}
          className="h-9 w-9 shrink-0 rounded-full border-border bg-card"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div
          ref={tagsRef}
          className="flex flex-1 gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SPECIALISATIONS.map((s) => {
            const active = activeSpecs.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpec(s)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-primary-glow bg-primary-glow/15 text-primary-glow"
                    : "border-border bg-card text-foreground/75 hover:border-primary-glow/60 hover:text-foreground"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scroll specialisations right"
          onClick={() => scrollTags("right")}
          className="h-9 w-9 shrink-0 rounded-full border-border bg-card"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((e) => (
          <ExpertCard key={e.name} expert={e} onConnect={() => setOpenExpert(e)} />
        ))}
      </div>

      <Dialog open={openExpert !== null} onOpenChange={(o) => !o && setOpenExpert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{openExpert?.name}</DialogTitle>
            <DialogDescription>
              {openExpert?.role} · {openExpert?.category}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(openExpert?.skills ?? []).map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-primary-glow/60 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-primary-glow"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              In-app messaging is coming soon. In the meantime, you can reach out by email.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpenExpert(null)}>
              Close
            </Button>
            <Button
              type="button"
              disabled
              className="cursor-not-allowed opacity-60"
              title="Available soon"
            >
              <Mail className="mr-2 h-4 w-4" />
              Send a message · Soon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

function ExpertCard({ expert, onConnect }: { expert: Expert; onConnect: () => void }) {
  return (
    <article className="group relative overflow-hidden rounded-[2rem] p-[2px] transition-transform duration-300 hover:-translate-y-1 [background:linear-gradient(180deg,hsl(var(--primary-glow))_0%,hsl(var(--primary))_100%)]">
      <div className="relative overflow-hidden rounded-[calc(2rem-2px)] bg-card">
        <div className="relative aspect-[3/4] w-full overflow-hidden">
          {expert.image ? (
            <img
              src={expert.image}
              alt={expert.name}
              loading="lazy"
              width={832}
              height={1088}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card to-background text-muted-foreground">
              <UserCircle2 className="h-24 w-24 opacity-60" />
            </div>
          )}
          {/* Bottom dark gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-background via-background/85 to-transparent" />

          {/* Overlay content */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
            <div>
              <h3 className="text-xl font-extrabold leading-tight tracking-tight text-foreground">
                {expert.name}
              </h3>
              <p className="text-xs text-foreground/85">
                {expert.role} <span className="mx-1 text-foreground/50">•</span> {expert.category}
              </p>
            </div>

            <div className="flex flex-wrap gap-[2px]">
              {expert.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-primary-glow/70 bg-background/30 px-2.5 py-1 text-[10px] font-medium text-primary-glow backdrop-blur-sm"
                >
                  {s}
                </span>
              ))}
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
                <Library className="h-3.5 w-3.5" />
                {expert.resources} resources
              </span>
              <button
                type="button"
                onClick={onConnect}
                className="group/btn inline-flex items-center gap-1.5 rounded-full bg-background py-1.5 pl-3.5 pr-1.5 text-xs font-semibold text-primary shadow-cyan transition hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Connect
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                  <Plus className="h-3 w-3" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default FindExperts;
