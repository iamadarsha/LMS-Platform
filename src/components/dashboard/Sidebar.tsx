import { NavLink } from "react-router-dom";
import { Home, Compass, Users, Wrench, PlusCircle, BarChart3, Clock, Heart, Settings, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  badge?: string;
  end?: boolean;
};

const main: Item[] = [
  { label: "Home", icon: Home, to: "/", end: true },
  { label: "Explore", icon: Compass, to: "/explore" },
  { label: "Find Experts", icon: Users, to: "/find-experts" },
];

const contribute: Item[] = [
  { label: "Resource", icon: PlusCircle, to: "/studio/contribute" },
  { label: "Fix the Itch", icon: Wrench, to: "/fix-the-itch", badge: "SOON" },
];

const mine: Item[] = [
  { label: "My Profile", icon: UserCircle, to: "/profile" },
  { label: "My Progress", icon: BarChart3, to: "/my-progress" },
  { label: "Recently Viewed", icon: Clock, to: "/recently-viewed" },
  { label: "My Favourites", icon: Heart, to: "/my-favourites" },
];

const system: Item[] = [{ label: "Settings", icon: Settings, to: "/settings" }];

function NavItem({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          isActive
            ? "bg-gradient-primary text-primary-foreground shadow-glow"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:before:absolute hover:before:left-0 hover:before:top-1/2 hover:before:h-5 hover:before:w-0.5 hover:before:-translate-y-1/2 hover:before:rounded-r-full hover:before:bg-primary/70",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left font-medium">{item.label}</span>
      {item.badge && (
        <span className="rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

export function DashboardSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar pt-20">
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {main.map((i) => <NavItem key={i.label} item={i} />)}
        </div>
        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Contribute
          </p>
          <div className="space-y-1">
            {contribute.map((i) => <NavItem key={i.label} item={i} />)}
          </div>
        </div>
        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Mine
          </p>
          <div className="space-y-1">
            {mine.map((i) => <NavItem key={i.label} item={i} />)}
          </div>
        </div>
        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            System
          </p>
          <div className="space-y-1">
            {system.map((i) => <NavItem key={i.label} item={i} />)}
          </div>
        </div>
      </nav>
    </aside>
  );
}