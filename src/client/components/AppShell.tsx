import type { ReactNode } from "react";
import { BottomTabs } from "./BottomTabs";

interface AppShellProps {
  activePath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

export function AppShell({ activePath, onNavigate, children }: AppShellProps) {
  return (
    <>
      <main className="app-main">{children}</main>
      <BottomTabs activePath={activePath} onNavigate={onNavigate} />
    </>
  );
}
