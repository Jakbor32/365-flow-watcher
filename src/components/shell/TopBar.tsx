import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({ mode }: { mode: "demo" | "live" | null }) {
  return (
    <>
      <header className="border-rule bg-paper/95 sticky top-0 z-20 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-accent font-mono text-[13px] font-medium">365</span>
            <span className="text-ink font-medium">Flow Watcher</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            <Link
              href="/"
              aria-current="page"
              className="text-ink aria-[current=page]:bg-paper-3 rounded-md px-2.5 py-1 whitespace-nowrap"
            >
              Flows
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {mode === "demo" && (
              <span className="text-muted hidden items-center gap-2 font-mono text-xs md:flex">
                <span className="whitespace-nowrap">contoso.com</span>
                <span className="text-rule-2">/</span>
                <span className="whitespace-nowrap">demo.admin</span>
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {/* Outside the sticky header so table headers can stick at a fixed 48px. */}
      {mode === "demo" && (
        <p className="border-rule bg-warn-wash text-warn border-b px-4 py-1.5 text-center font-mono text-[11px] tracking-wide sm:px-6">
          DEMO TENANT · fictional data
          <span className="hidden sm:inline"> · nothing you do here is saved</span>
        </p>
      )}
    </>
  );
}
