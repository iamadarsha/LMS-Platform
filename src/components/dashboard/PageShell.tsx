import type { ReactNode } from "react";
import { DashboardHeader } from "./Header";
import { DashboardSidebar } from "./Sidebar";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function PageShell({ eyebrow, title, description, children }: Props) {
  return (
    <div className="blueprint-bg min-h-screen text-foreground">
      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="ml-64 flex-1 px-8 pb-24 pt-24">
          <div className="mx-auto max-w-[1400px] space-y-10">
            <header className="space-y-3">
              {eyebrow && (
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                {title}
              </h1>
              {description && (
                <p className="max-w-2xl text-base text-muted-foreground">{description}</p>
              )}
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}