import { useState } from "react";
import { Bell, Lock, Palette, User, Loader2 } from "lucide-react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { PageShell } from "@/components/dashboard/PageShell";
import { cn } from "@/lib/utils";

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: Lock },
] as const;

type SectionId = (typeof sections)[number]["id"];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-gradient-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

const Settings = () => {
  const [active, setActive] = useState<SectionId>("profile");
  const [notif, setNotif] = useState({ digest: true, mentions: true, marketing: false });
  const [theme, setTheme] = useState<"system" | "dark" | "light">("dark");
  const { isLoaded, user } = useUser();
  const { openUserProfile } = useClerk();

  const displayName =
    user?.fullName?.trim() ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <PageShell
      eyebrow="ACCOUNT // SETTINGS"
      title="Settings"
      description="Manage your account, notifications and appearance."
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-1">
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="neon-border neon-subtle space-y-6 p-6">
          {active === "profile" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-foreground">Profile</h2>
                {!isLoaded && (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Display name</span>
                  <input
                    value={displayName}
                    readOnly
                    className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm text-foreground/90 cursor-not-allowed focus:outline-none"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Email</span>
                  <input
                    value={email}
                    readOnly
                    className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm text-foreground/90 cursor-not-allowed focus:outline-none"
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Profile details come from your sign-in account.{" "}
                <button
                  type="button"
                  onClick={() => openUserProfile()}
                  className="font-medium text-primary underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Edit your profile
                </button>{" "}
                to update them.
              </p>
            </div>
          )}

          {active === "notifications" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-foreground">Notifications</h2>
              {[
                { key: "digest" as const, label: "Weekly digest", desc: "A summary of new content tailored to you." },
                { key: "mentions" as const, label: "Mentions & replies", desc: "Get notified when someone tags you." },
                { key: "marketing" as const, label: "Product updates", desc: "Occasional emails about new features." },
              ].map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/40 p-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.desc}</p>
                  </div>
                  <Toggle
                    checked={notif[row.key]}
                    onChange={(v) => setNotif((n) => ({ ...n, [row.key]: v }))}
                  />
                </div>
              ))}
            </div>
          )}

          {active === "appearance" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-foreground">Appearance</h2>
              <div className="grid grid-cols-3 gap-3">
                {(["system", "dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      "rounded-xl border p-4 text-center text-sm font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      theme === t
                        ? "border-primary bg-gradient-primary text-primary-foreground shadow-violet"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {active === "security" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-foreground">Security</h2>
              <p className="text-xs text-muted-foreground">
                Hyvemind uses Clerk for sign-in. Open your account settings to update password,
                connected providers, or two-factor authentication.
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => openUserProfile()}
                  className="w-full rounded-lg border border-border bg-card/60 p-4 text-left transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <p className="text-sm font-semibold text-foreground">Change password</p>
                  <p className="text-xs text-muted-foreground">Opens your account security settings.</p>
                </button>
                <button
                  type="button"
                  onClick={() => openUserProfile()}
                  className="w-full rounded-lg border border-border bg-card/60 p-4 text-left transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <p className="text-sm font-semibold text-foreground">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
                </button>
                <button
                  type="button"
                  onClick={() => openUserProfile()}
                  className="w-full rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-left text-destructive transition hover:border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <p className="text-sm font-semibold">Delete account</p>
                  <p className="text-xs opacity-80">Permanently remove your account and data.</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default Settings;
