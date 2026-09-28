import type {
  Flow,
  FlowState,
  Permission,
  PermissionRole,
  Person,
  Run,
  RunStatus,
  TriggerKind,
} from "@/lib/domain/types";
import { asRecord, str } from "./http";

// Microsoft's payloads are loosely typed and differ between endpoints; every
// field is read defensively and anything unusable is dropped, not guessed.

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function guid(value: unknown): string | null {
  const match = typeof value === "string" ? value.match(GUID) : null;
  return match ? match[0].toLowerCase() : null;
}

export function flowIdOf(raw: unknown): string | null {
  const record = asRecord(raw);
  return guid(record?.name) ?? guid(str(record?.id)?.split("/").pop());
}

export function creatorIdOf(raw: unknown): string | null {
  const creator = asRecord(asRecord(asRecord(raw)?.properties)?.creator);
  return guid(creator?.objectId) ?? guid(creator?.userId) ?? guid(creator?.id);
}

/** The owner is resolved separately (Graph), so it is passed in. */
export function normalizeFlow(raw: unknown, environmentId: string, owner: Person): Flow | null {
  const record = asRecord(raw);
  const id = flowIdOf(raw);
  if (!record || !id) return null;
  const properties = asRecord(record.properties) ?? {};
  const created = str(properties.createdTime) ?? new Date(0).toISOString();

  return {
    id,
    displayName: str(properties.displayName) ?? id,
    environmentId,
    state: flowState(properties.state),
    owner,
    createdAt: created,
    modifiedAt: str(properties.lastModifiedTime) ?? created,
    trigger: trigger(properties),
    connectors: connectors(properties.connectionReferences),
    portalUrl: `https://make.powerautomate.com/environments/${encodeURIComponent(environmentId)}/flows/${id}/details`,
  };
}

function flowState(value: unknown): FlowState {
  const state = str(value)?.toLowerCase();
  if (state === "started" || state === "enabled") return "enabled";
  if (state === "suspended") return "suspended";
  return "disabled";
}

function trigger(properties: Record<string, unknown>): Flow["trigger"] {
  const summary = asRecord(properties.definitionSummary);
  const first = asRecord(Array.isArray(summary?.triggers) ? summary.triggers[0] : null);
  const type = str(first?.type)?.toLowerCase() ?? "";
  const kind: TriggerKind =
    type === "recurrence"
      ? "recurrence"
      : type === "request" || type === "manual"
        ? "instant"
        : "automated";
  const operation = str(first?.swaggerOperationId) ?? str(first?.operationId) ?? str(first?.kind);
  return { kind, label: operation ? humanize(operation) : humanize(type || "unknown trigger") };
}

function connectors(value: unknown): string[] {
  const references = asRecord(value);
  if (!references) return [];
  const names = new Set<string>();
  for (const [key, raw] of Object.entries(references)) {
    const reference = asRecord(raw);
    const api = asRecord(reference?.api);
    const name = str(api?.displayName) ?? str(reference?.displayName) ?? str(api?.name) ?? key;
    names.add(name.replace(/^shared_/, ""));
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

const RUN_STATUS: Record<string, RunStatus> = {
  succeeded: "Succeeded",
  failed: "Failed",
  timedout: "Failed",
  cancelled: "Cancelled",
  aborted: "Cancelled",
  skipped: "Cancelled",
  running: "Running",
  waiting: "Running",
};

export function normalizeRun(raw: unknown, flowId: string): Run | null {
  const record = asRecord(raw);
  const properties = asRecord(record?.properties) ?? {};
  const startTime = str(properties.startTime);
  const id = str(record?.name);
  if (!id || !startTime) return null;

  const status = RUN_STATUS[str(properties.status)?.toLowerCase() ?? ""] ?? "Cancelled";
  const endTime = str(properties.endTime);
  const error = asRecord(properties.error);
  const durationMs = endTime ? Math.max(0, Date.parse(endTime) - Date.parse(startTime)) : null;

  return {
    id,
    flowId,
    status,
    startTime,
    endTime,
    durationMs,
    error:
      status === "Failed"
        ? {
            code: str(error?.code) ?? str(properties.code) ?? "Failed",
            message: str(error?.message) ?? "The run failed without an error message.",
            // The run list doesn't say which action failed; that needs one
            // extra call per run, so it's left out.
            action: null,
          }
        : null,
  };
}

const ROLES: Record<string, PermissionRole> = {
  owner: "Owner",
  canedit: "CanEdit",
  canview: "CanView",
};

/** `people` maps principal object ID to the Graph-resolved person. */
export function normalizePermission(raw: unknown, people: Map<string, Person>): Permission | null {
  const record = asRecord(raw);
  const properties = asRecord(record?.properties);
  const principal = asRecord(properties?.principal);
  const principalId = guid(principal?.id);
  const role = ROLES[str(properties?.roleName)?.toLowerCase() ?? ""];
  if (!record || !principalId || !role) return null;

  const person = people.get(principalId) ?? {
    id: principalId,
    displayName: str(principal?.displayName) ?? principalId,
    email: (str(principal?.email) ?? str(principal?.userPrincipalName) ?? "").toLowerCase(),
    department: null,
    // Not found in Graph (or a group): treat as deleted, the safe default for orphan detection.
    status: "deleted" as const,
  };
  // modifyPermissions deletes by principal object ID, so that is the ID here.
  return { id: principalId, role, principal: person };
}

export function principalIdsOf(rawPermissions: unknown[]): string[] {
  return rawPermissions
    .map((raw) => guid(asRecord(asRecord(asRecord(raw)?.properties)?.principal)?.id))
    .filter((id): id is string => id !== null);
}

function humanize(value: string): string {
  const spaced = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
