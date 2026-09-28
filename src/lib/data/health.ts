import { isOrphaned } from "@/lib/domain/orphans";
import type { DailyRuns, Flow, FlowWithHealth, Permission, Run } from "@/lib/domain/types";

export const HEALTH_WINDOW_DAYS = 7;
export const SPARKLINE_DAYS = 14;

const DAY = 24 * 3_600_000;

/** `runs` must be sorted newest first. */
export function withHealth(
  flow: Flow,
  runs: Run[],
  permissions: Permission[],
  now: Date,
): FlowWithHealth {
  const windowStart = now.getTime() - HEALTH_WINDOW_DAYS * DAY;
  const recent = runs.filter((run) => Date.parse(run.startTime) >= windowStart);

  return {
    ...flow,
    lastRun: runs[0] ?? null,
    recentRuns: recent.length,
    recentFailures: recent.filter((run) => run.status === "Failed").length,
    daily: dailyBuckets(runs, now, SPARKLINE_DAYS),
    orphaned: isOrphaned(flow, permissions),
  };
}

export function dailyBuckets(runs: Run[], now: Date, days: number): DailyRuns[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const buckets: DailyRuns[] = Array.from({ length: days }, (_, index) => ({
    day: new Date(today - (days - 1 - index) * DAY).toISOString().slice(0, 10),
    succeeded: 0,
    failed: 0,
  }));
  const byDay = new Map(buckets.map((bucket) => [bucket.day, bucket]));

  for (const run of runs) {
    const bucket = byDay.get(run.startTime.slice(0, 10));
    if (!bucket) continue;
    if (run.status === "Succeeded") bucket.succeeded++;
    else if (run.status === "Failed") bucket.failed++;
  }

  return buckets;
}
