"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { Run } from "@/lib/domain/types";
import { formatDateTime, timeAgo } from "@/lib/format";
import { RunDot } from "@/components/ui/Status";
import { buttonClass } from "@/components/ui/Dialog";

const PAGE_SIZES = [10, 50, 100];

export function RunHistory({ flowId, now }: { flowId: string; now: number }) {
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedOnly, setFailedOnly] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<{ runs: Run[] }>(`/api/flows/${flowId}/runs?limit=${limit}`, { signal: controller.signal })
      .then((body) => setRuns(body.runs))
      .catch((err: Error) => err.name !== "AbortError" && setError(err.message));
    return () => controller.abort();
  }, [flowId, limit]);

  const visible = useMemo(
    () => (runs ?? []).filter((run) => !failedOnly || run.status === "Failed"),
    [runs, failedOnly],
  );
  const topError = useMemo(() => mostCommonError(runs ?? []), [runs]);
  const nextSize = PAGE_SIZES.find((size) => size > limit);
  const mayHaveMore = runs !== null && runs.length === limit && nextSize !== undefined;

  return (
    <section aria-labelledby="runs-title">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <h2 id="runs-title" className="font-medium">
          Recent runs
          {runs && (
            <span className="ml-2 font-mono text-xs font-normal text-muted">
              last {runs.length}
            </span>
          )}
        </h2>
        <div role="group" aria-label="Show" className="flex rounded-md border border-rule p-0.5">
          {[
            { label: "All", value: false },
            { label: "Failed", value: true },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={failedOnly === option.value}
              onClick={() => setFailedOnly(option.value)}
              className="h-7 rounded px-3 text-xs text-muted hover:text-ink aria-pressed:bg-paper-3 aria-pressed:text-ink"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {topError && (
        <p className="border-t border-rule bg-fail-wash px-4 py-2 text-xs sm:px-6">
          <span className="font-mono text-fail">{topError.code}</span>
          <span className="text-muted"> · {topError.count}× in these runs</span>
          {topError.action && (
            <>
              <span className="text-muted"> · failing at </span>
              <span className="font-mono text-ink-2">{topError.action}</span>
            </>
          )}
        </p>
      )}

      {error ? (
        <p className="border-t border-rule px-4 py-6 font-mono text-xs text-fail sm:px-6">
          {error}
        </p>
      ) : runs === null ? (
        <p className="border-t border-rule px-4 py-6 font-mono text-xs text-muted sm:px-6">
          Loading runs…
        </p>
      ) : visible.length === 0 ? (
        <p className="border-t border-rule px-4 py-6 text-muted sm:px-6">
          {failedOnly ? "No failed runs in this range." : "No runs in the last 30 days."}
        </p>
      ) : (
        <ol className="divide-y divide-rule border-y border-rule">
          {visible.map((run) => (
            <li key={run.id} className="px-4 py-2.5 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex w-24 items-center gap-2 text-sm text-ink-2">
                  <RunDot status={run.status} />
                  {run.status}
                </span>
                <time
                  dateTime={run.startTime}
                  className="tabular font-mono text-xs text-ink-2"
                  title={timeAgo(run.startTime, now)}
                >
                  {formatDateTime(run.startTime)}
                </time>
                <span className="tabular ml-auto font-mono text-xs text-muted">
                  {run.durationMs === null ? "running" : formatDuration(run.durationMs)}
                </span>
              </div>
              {run.error && (
                <div className="mt-1.5 grid gap-0.5 sm:pl-28">
                  <p className="font-mono text-xs">
                    <span className="text-fail">{run.error.code}</span>
                    {run.error.action && <span className="text-muted"> at {run.error.action}</span>}
                  </p>
                  <p className="text-xs break-words text-muted">{run.error.message}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {mayHaveMore && (
        <div className="px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => nextSize && setLimit(nextSize)}
            className={buttonClass.secondary}
          >
            Show last {nextSize}
          </button>
        </div>
      )}
    </section>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function mostCommonError(runs: Run[]) {
  const counts = new Map<string, { code: string; action: string | null; count: number }>();
  for (const run of runs) {
    if (!run.error) continue;
    const key = `${run.error.code}|${run.error.action}`;
    const entry = counts.get(key) ?? {
      code: run.error.code,
      action: run.error.action,
      count: 0,
    };
    entry.count++;
    counts.set(key, entry);
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return top && top.count >= 2 ? top : null;
}
