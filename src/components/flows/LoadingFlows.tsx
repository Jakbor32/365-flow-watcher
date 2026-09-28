"use client";

import { useEffect, useState } from "react";

/** Skeleton rows plus an honest timer: the first load on a big tenant is slow. */
export function LoadingFlows() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="border-t border-rule" role="status" aria-live="polite">
      <p className="flex items-center gap-3 px-4 py-3 font-mono text-xs text-muted sm:px-6">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
        <span>
          Loading flows… <span className="tabular">{seconds}s</span>
        </span>
        {seconds >= 5 && (
          <span className="hidden sm:inline">
            · the first load reads every flow&apos;s run history, big environments take a minute
          </span>
        )}
      </p>
      <ul aria-hidden className="divide-y divide-rule border-t border-rule">
        {Array.from({ length: 8 }, (_, row) => (
          <li key={row} className="flex items-center gap-6 px-4 py-3.5 sm:px-6">
            <div className="grid flex-1 gap-2">
              <div
                className="h-3 animate-pulse rounded bg-paper-3"
                style={{ width: `${40 + ((row * 17) % 35)}%` }}
              />
              <div className="h-2 w-24 animate-pulse rounded bg-paper-2" />
            </div>
            <div className="hidden h-3 w-28 animate-pulse rounded bg-paper-3 md:block" />
            <div className="hidden h-3 w-16 animate-pulse rounded bg-paper-3 md:block" />
            <div className="h-4 w-14 animate-pulse rounded bg-paper-2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
