import type { FlowWithHealth } from "@/lib/domain/types";

const COLUMNS: [string, (flow: FlowWithHealth) => string | number | boolean][] = [
  ["Flow ID", (flow) => flow.id],
  ["Name", (flow) => flow.displayName],
  ["State", (flow) => flow.state],
  ["Owner", (flow) => flow.owner.displayName],
  ["Owner email", (flow) => flow.owner.email],
  ["Owner account", (flow) => flow.owner.status],
  ["Orphaned", (flow) => flow.orphaned],
  ["Trigger", (flow) => flow.trigger.label],
  ["Connectors", (flow) => flow.connectors.join("; ")],
  ["Created", (flow) => flow.createdAt],
  ["Modified", (flow) => flow.modifiedAt],
  ["Last run status", (flow) => flow.lastRun?.status ?? ""],
  ["Last run start", (flow) => flow.lastRun?.startTime ?? ""],
  ["Runs (7 days)", (flow) => flow.recentRuns],
  ["Failures (7 days)", (flow) => flow.recentFailures],
  ["Environment", (flow) => flow.environmentId],
  ["Portal URL", (flow) => flow.portalUrl],
];

/**
 * RFC 4180 CSV. Cells that start with = + - @ or a control character are
 * prefixed with a quote so Excel does not run them as formulas: flow names
 * are user-controlled, and this file will be opened by an admin.
 */
export function toCsv(flows: FlowWithHealth[]): string {
  const rows = [
    COLUMNS.map(([header]) => header),
    ...flows.map((flow) => COLUMNS.map(([, read]) => String(read(flow)))),
  ];
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

export function escapeCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvFileName(now = new Date()): string {
  return `flows-${now.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
}
