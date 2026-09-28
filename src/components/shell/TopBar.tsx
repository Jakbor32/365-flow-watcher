import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export function TopBar({ mode }: { mode: "demo" | "live" | null }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
            <span className="font-mono text-[13px] font-medium text-accent">365</span>
            <span className="hidden font-medium text-ink min-[400px]:inline">Flow Watcher</span>
          </Link>

          <NavLinks />

          <div className="ml-auto flex items-center gap-3">
            <UserMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>
      {/* Outside the sticky header so table headers can stick at a fixed 48px. */}
      {mode === "demo" && (
        <p className="border-b border-rule bg-warn-wash px-4 py-1.5 text-center font-mono text-[11px] tracking-wide text-warn sm:px-6">
          DEMO TENANT · fictional data
          <span className="hidden sm:inline"> · nothing you do here is saved</span>
        </p>
      )}
    </>
  );
}
