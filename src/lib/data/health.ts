import { isOrphaned } from "@/lib/domain/orphans";
import type { Flow, Permission, Run } from "@/lib/domain/types";
import type { FlowWithHealth } from "./source";

export const HEALTH_WINDOW_DAYS = 7;

/** `runs` must be sorted newest first. */
export function withHealth(
  flow: Flow,
  runs: Run[],
  permissions: Permission[],
  now: Date,
): FlowWithHealth {
  const windowStart = now.getTime() - HEALTH_WINDOW_DAYS * 24 * 3_600_000;
  const recent = runs.filter((run) => Date.parse(run.startTime) >= windowStart);

  return {
    ...flow,
    lastRun: runs[0] ?? null,
    recentRuns: recent.length,
    recentFailures: recent.filter((run) => run.status === "Failed").length,
    orphaned: isOrphaned(flow, permissions),
  };
}
