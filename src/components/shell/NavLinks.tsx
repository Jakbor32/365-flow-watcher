"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Flows", match: (path: string) => path === "/" || path.startsWith("/flows") },
  { href: "/insights", label: "Insights", match: (path: string) => path.startsWith("/insights") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.match(pathname) ? "page" : undefined}
          className="rounded-md px-2.5 py-1 whitespace-nowrap text-muted hover:text-ink aria-[current=page]:bg-paper-3 aria-[current=page]:text-ink"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
