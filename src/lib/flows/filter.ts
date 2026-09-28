import type { FlowState, FlowWithHealth } from "@/lib/domain/types";

export type HealthFilter = "all" | "failing" | "healthy" | "idle";
export type SortKey = "name" | "failures" | "lastRun" | "owner";

export interface FlowQuery {
  search: string;
  state: FlowState | "all";
  health: HealthFilter;
  owner: string; // owner email, or "" for all
  connector: string; // connector name, or "" for all
  orphanedOnly: boolean;
  sort: SortKey;
  descending: boolean;
}

export const DEFAULT_QUERY: FlowQuery = {
  search: "",
  state: "all",
  health: "all",
  owner: "",
  connector: "",
  orphanedOnly: false,
  // An ops console opens on the problems, not on the alphabet.
  sort: "failures",
  descending: true,
};

const STATES = new Set(["all", "enabled", "disabled", "suspended"]);
const HEALTHS = new Set(["all", "failing", "healthy", "idle"]);
const SORTS = new Set(["name", "failures", "lastRun", "owner"]);

/** Read a query from URL search params, ignoring anything unexpected. */
export function parseQuery(params: URLSearchParams): FlowQuery {
  const pick = <T extends string>(name: string, allowed: Set<string>, fallback: T): T => {
    const value = params.get(name);
    return value && allowed.has(value) ? (value as T) : fallback;
  };

  return {
    search: params.get("q")?.slice(0, 200) ?? "",
    state: pick("state", STATES, DEFAULT_QUERY.state),
    health: pick("health", HEALTHS, DEFAULT_QUERY.health),
    owner: params.get("owner") ?? "",
    connector: params.get("connector") ?? "",
    orphanedOnly: params.get("orphaned") === "1",
    sort: pick("sort", SORTS, DEFAULT_QUERY.sort),
    descending: params.has("sort") ? params.get("dir") !== "asc" : DEFAULT_QUERY.descending,
  };
}

/** Only non-default values, so shared URLs stay short. */
export function serializeQuery(query: FlowQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.state !== "all") params.set("state", query.state);
  if (query.health !== "all") params.set("health", query.health);
  if (query.owner) params.set("owner", query.owner);
  if (query.connector) params.set("connector", query.connector);
  if (query.orphanedOnly) params.set("orphaned", "1");
  if (query.sort !== DEFAULT_QUERY.sort || query.descending !== DEFAULT_QUERY.descending) {
    params.set("sort", query.sort);
    params.set("dir", query.descending ? "desc" : "asc");
  }
  return params;
}

export function activeFilterCount(query: FlowQuery): number {
  return [
    query.state !== "all",
    query.health !== "all",
    query.owner !== "",
    query.connector !== "",
    query.orphanedOnly,
  ].filter(Boolean).length;
}

export function filterFlows(flows: FlowWithHealth[], query: FlowQuery): FlowWithHealth[] {
  const needle = query.search.trim().toLowerCase();

  const matches = flows.filter((flow) => {
    if (query.state !== "all" && flow.state !== query.state) return false;
    if (query.orphanedOnly && !flow.orphaned) return false;
    if (query.owner && flow.owner.email !== query.owner) return false;
    if (query.connector && !flow.connectors.includes(query.connector)) return false;
    if (query.health === "failing" && flow.recentFailures === 0) return false;
    if (query.health === "healthy" && (flow.recentFailures > 0 || flow.recentRuns === 0)) {
      return false;
    }
    if (query.health === "idle" && flow.recentRuns > 0) return false;

    if (!needle) return true;
    return [flow.displayName, flow.owner.displayName, flow.owner.email, flow.id].some((field) =>
      field.toLowerCase().includes(needle),
    );
  });

  return sortFlows(matches, query.sort, query.descending);
}

function sortFlows(flows: FlowWithHealth[], key: SortKey, descending: boolean) {
  const byName = (a: FlowWithHealth, b: FlowWithHealth) =>
    a.displayName.localeCompare(b.displayName);

  const compare: Record<SortKey, (a: FlowWithHealth, b: FlowWithHealth) => number> = {
    name: byName,
    owner: (a, b) => a.owner.displayName.localeCompare(b.owner.displayName),
    lastRun: (a, b) => lastRunTime(a) - lastRunTime(b),
    // Failure count first, failure rate breaks ties.
    failures: (a, b) => a.recentFailures - b.recentFailures || failureRate(a) - failureRate(b),
  };

  const direction = descending ? -1 : 1;
  return [...flows].sort((a, b) => direction * compare[key](a, b) || byName(a, b));
}

export function failureRate(flow: FlowWithHealth): number {
  return flow.recentRuns === 0 ? 0 : flow.recentFailures / flow.recentRuns;
}

function lastRunTime(flow: FlowWithHealth): number {
  return flow.lastRun ? Date.parse(flow.lastRun.startTime) : 0;
}

export interface FlowSummary {
  total: number;
  enabled: number;
  failing: number;
  orphaned: number;
  runs: number;
  failures: number;
}

export function summarize(flows: FlowWithHealth[]): FlowSummary {
  return flows.reduce<FlowSummary>(
    (summary, flow) => ({
      total: summary.total + 1,
      enabled: summary.enabled + (flow.state === "enabled" ? 1 : 0),
      failing: summary.failing + (flow.recentFailures > 0 ? 1 : 0),
      orphaned: summary.orphaned + (flow.orphaned ? 1 : 0),
      runs: summary.runs + flow.recentRuns,
      failures: summary.failures + flow.recentFailures,
    }),
    { total: 0, enabled: 0, failing: 0, orphaned: 0, runs: 0, failures: 0 },
  );
}

/** Distinct owners and connectors, for the filter dropdowns. */
export function facets(flows: FlowWithHealth[]) {
  const owners = new Map<string, string>();
  const connectors = new Set<string>();
  for (const flow of flows) {
    owners.set(flow.owner.email, flow.owner.displayName);
    flow.connectors.forEach((connector) => connectors.add(connector));
  }
  return {
    owners: [...owners]
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    connectors: [...connectors].sort(),
  };
}
