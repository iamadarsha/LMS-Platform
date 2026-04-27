import { NavLink } from "react-router-dom";
import { LayoutDashboard, PlusCircle, BarChart3, ArrowDownUp } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  end?: boolean;
};

const items: Item[] = [
  { label: "Contribute", icon: PlusCircle, to: "/studio/contribute" },
  { label: "Dashboard", icon: LayoutDashboard, to: "/studio", end: true },
  { label: "XP History", icon: BarChart3, to: "/studio/xp-history" },
  { label: "Transfer", icon: ArrowDownUp, to: "/studio/transfer" },
];

function NavItem({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
          isActive
            ? "bg-gradient-primary text-primary-foreground shadow-violet"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left font-medium">{item.label}</span>
    </NavLink>
  );
}

export function StudioSidebar() {
  const { user, isLoaded } = useUser();

  const displayName = isLoaded
    ? user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "Creator"
    : "";

  const initials = displayName
    ? displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "…";

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar pt-20">
      {/* Profile block */}
      <div className="flex flex-col items-center gap-3 px-6 pb-8 pt-4 text-center">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={displayName}
            className="h-24 w-24 rounded-full object-cover ring-2 ring-primary/30"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-foreground">
            {initials}
          </div>
        )}
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">
            {isLoaded ? displayName || "Your Profile" : "Loading…"}
          </p>
          <p className="text-xs text-muted-foreground">
            {user?.primaryEmailAddress?.emailAddress ?? ""}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((i) => (
          <NavItem key={i.label} item={i} />
        ))}
      </nav>
    </aside>
  );
}
