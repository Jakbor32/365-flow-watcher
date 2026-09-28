"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

type Status = "pass" | "warn" | "fail";
interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
  fix?: string;
}

// Status is carried by a word and a symbol, never by color alone.
const BADGE: Record<Status, { text: string; symbol: string; className: string }> = {
  pass: { text: "OK", symbol: "✓", className: "text-ok" },
  warn: { text: "Check", symbol: "!", className: "text-warn" },
  fail: { text: "Failing", symbol: "✕", className: "text-fail" },
};

export function DiagnosticsView() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<{ checks: Check[] }>("/api/diagnostics", { signal: controller.signal })
      .then((body) => setChecks(body.checks))
      .catch((err: Error) => err.name !== "AbortError" && setError(err.message));
    return () => controller.abort();
  }, []);

  const failing = checks?.filter((check) => check.status === "fail").length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="px-4 pt-6 pb-4 sm:px-6">
        <h1 className="text-xl font-medium">Diagnostics</h1>
        <p className="mt-0.5 text-xs text-muted">
          Checks your sign-in, permissions and configuration. Read-only.
        </p>
      </div>

      {error ? (
        <p className="border-t border-rule px-4 py-6 font-mono text-xs text-fail sm:px-6">
          {error}
        </p>
      ) : checks === null ? (
        <p className="border-t border-rule px-4 py-6 font-mono text-xs text-muted sm:px-6">
          Running checks…
        </p>
      ) : (
        <>
          <p className="border-y border-rule px-4 py-3 text-sm sm:px-6" role="status">
            {failing === 0 ? (
              <span className="text-ok">Everything required is in place.</span>
            ) : (
              <span className="text-fail">
                {failing} {failing === 1 ? "check is" : "checks are"} failing.
              </span>
            )}
          </p>
          <ul className="divide-y divide-rule border-b border-rule">
            {checks.map((check) => {
              const badge = BADGE[check.status];
              return (
                <li
                  key={check.id}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 px-4 py-3 sm:px-6"
                >
                  <span className={`font-mono text-xs whitespace-nowrap ${badge.className}`}>
                    <span aria-hidden>{badge.symbol}</span> {badge.text}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink">{check.label}</p>
                    <p className="text-xs break-words text-muted">{check.detail}</p>
                    {check.fix && (
                      <p className="mt-1 text-xs break-words text-ink-2">→ {check.fix}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
