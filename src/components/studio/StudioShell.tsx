import type { ReactNode } from "react";
import { StudioHeader } from "./StudioHeader";
import { StudioSidebar } from "./StudioSidebar";

type Props = {
  children: ReactNode;
};

export function StudioShell({ children }: Props) {
  return (
    <div className="blueprint-bg min-h-screen text-foreground">
      <StudioHeader />
      <div className="flex">
        <StudioSidebar />
        <main className="ml-64 flex-1 px-8 pb-24 pt-24">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}