import type { DailyRuns, FlowWithHealth, Person, Run } from "@/lib/domain/types";

const DAY = 24 * 3_600_000;
const TOP = 8;

export interface Insights {
  /** Tenant-wide runs per day, oldest first. */
  daily: DailyRuns[];
  topFailing: { id: string; name: string; failures: number; runs: number }[];
  commonErrors: {
    code: string;
    /** Null when the source can't tell (live run lists omit it). */
    action: string | null;
    count: number;
    flows: number;
    example: string;
    lastSeen: string;
  }[];
  connectors: { name: string; flows: number; failing: number }[];
  ownershipRisk: {
    owner: Person;
    flows: number;
    orphaned: number;
    failing: number;
  }[];
}

/**
 * `runsByFlow` only needs the flows that failed recently: errors can only come
 * from them, which keeps live mode to a handful of run-history calls.
 */
export function buildInsights(
  flows: FlowWithHealth[],
  runsByFlow: Map<string, Run[]>,
  now: Date,
  windowDays = 7,
): Insights {
  return {
    daily: sumDaily(flows),
    topFailing: flows
      .filter((flow) => flow.recentFailures > 0)
      .sort(
        (a, b) => b.recentFailures - a.recentFailures || a.displayName.localeCompare(b.displayName),
      )
      .slice(0, TOP)
      .map((flow) => ({
        id: flow.id,
        name: flow.displayName,
        failures: flow.recentFailures,
        runs: flow.recentRuns,
      })),
    commonErrors: groupErrors(runsByFlow, now.getTime() - windowDays * DAY),
    connectors: connectorStats(flows),
    ownershipRisk: ownershipRisk(flows),
  };
}

function sumDaily(flows: FlowWithHealth[]): DailyRuns[] {
  const days = new Map<string, DailyRuns>();
  for (const flow of flows) {
    for (const day of flow.daily) {
      const total = days.get(day.day) ?? { day: day.day, succeeded: 0, failed: 0 };
      total.succeeded += day.succeeded;
      total.failed += day.failed;
      days.set(day.day, total);
    }
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function groupErrors(runsByFlow: Map<string, Run[]>, since: number) {
  const groups = new Map<string, Insights["commonErrors"][number] & { flowIds: Set<string> }>();
  for (const [flowId, runs] of runsByFlow) {
    for (const run of runs) {
      if (!run.error || Date.parse(run.startTime) < since) continue;
      const action = run.error.action;
      const key = `${run.error.code}|${action}`;
      const group = groups.get(key) ?? {
        code: run.error.code,
        action,
        count: 0,
        flows: 0,
        example: run.error.message,
        lastSeen: run.startTime,
        flowIds: new Set<string>(),
      };
      group.count++;
      group.flowIds.add(flowId);
      if (run.startTime > group.lastSeen) group.lastSeen = run.startTime;
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map(({ flowIds, ...group }) => ({ ...group, flows: flowIds.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP);
}

function connectorStats(flows: FlowWithHealth[]) {
  const stats = new Map<string, { name: string; flows: number; failing: number }>();
  for (const flow of flows) {
    for (const name of flow.connectors) {
      const entry = stats.get(name) ?? { name, flows: 0, failing: 0 };
      entry.flows++;
      if (flow.recentFailures > 0) entry.failing++;
      stats.set(name, entry);
    }
  }
  return [...stats.values()].sort((a, b) => b.flows - a.flows || a.name.localeCompare(b.name));
}

function ownershipRisk(flows: FlowWithHealth[]) {
  const owners = new Map<string, Insights["ownershipRisk"][number]>();
  for (const flow of flows) {
    if (flow.owner.status === "active") continue;
    const entry = owners.get(flow.owner.id) ?? {
      owner: flow.owner,
      flows: 0,
      orphaned: 0,
      failing: 0,
    };
    entry.flows++;
    if (flow.orphaned) entry.orphaned++;
    if (flow.recentFailures > 0) entry.failing++;
    owners.set(flow.owner.id, entry);
  }
  return [...owners.values()].sort((a, b) => b.orphaned - a.orphaned || b.flows - a.flows);
}
