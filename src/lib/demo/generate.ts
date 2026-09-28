import type {
  Flow,
  FlowState,
  Permission,
  PermissionRole,
  Person,
  Run,
  RunError,
} from "@/lib/domain/types";
import {
  DEMO_DOMAIN,
  DEPARTMENTS,
  ERRORS,
  FLOW_TEMPLATES,
  ORPHAN_ERROR,
  PEOPLE,
  SERVICE_ACCOUNTS,
  SUFFIXES,
  type ErrorTemplate,
  type FlowTemplate,
} from "./catalog";
import { createRandom, type Random } from "./random";

export const DEMO_ENVIRONMENT_ID = "Default-00000000-0000-4000-8000-000000000365";
export const DEMO_SEED = 365;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const HISTORY_DAYS = 30;
// Hourly flows produce 720 runs in 30 days; the cap only guards against mistakes.
const MAX_RUNS_PER_FLOW = 800;

export interface DemoTenant {
  people: Person[];
  flows: Flow[];
  /** Newest first. */
  runsByFlow: Map<string, Run[]>;
  permissionsByFlow: Map<string, Permission[]>;
}

export interface GenerateOptions {
  seed?: number;
  now: Date;
  flowCount?: number;
}

type Health =
  | { kind: "healthy"; failRate: number }
  | { kind: "flaky"; failRate: number }
  | { kind: "broken"; since: number; error: ErrorTemplate };

export function generateDemoTenant({
  seed = DEMO_SEED,
  now,
  flowCount = 100,
}: GenerateOptions): DemoTenant {
  const random = createRandom(seed);
  const nowMs = now.getTime();

  const people = createPeople(random);
  const humans = people.filter((person) => !person.email.startsWith("svc-"));
  const services = people.filter((person) => person.email.startsWith("svc-"));
  const activeHumans = humans.filter((person) => person.status === "active");
  const inactiveHumans = humans.filter((person) => person.status !== "active");

  const flows: Flow[] = [];
  const runsByFlow = new Map<string, Run[]>();
  const permissionsByFlow = new Map<string, Permission[]>();
  const usedNames = new Set<string>();

  for (let index = 0; index < flowCount; index++) {
    const template = random.pick(FLOW_TEMPLATES);

    // Roughly one flow in ten belongs to someone who has left.
    const ownerPool = random.chance(0.1)
      ? inactiveHumans
      : random.chance(0.35)
        ? services
        : activeHumans;
    const owner = random.pick(ownerPool);

    const displayName = uniqueName(random, template, owner.department, usedNames);

    const createdAt = nowMs - random.int(40, 900) * DAY - random.int(0, 23) * HOUR;
    const state = pickState(random);
    const stateChangedAt = nowMs - random.int(1, 25) * DAY - random.int(0, 23) * HOUR;
    const modifiedAt =
      state === "enabled" ? Math.max(createdAt, nowMs - random.int(1, 200) * DAY) : stateChangedAt;

    const id = random.guid();
    const flow: Flow = {
      id,
      displayName,
      environmentId: DEMO_ENVIRONMENT_ID,
      state,
      owner,
      createdAt: iso(createdAt),
      modifiedAt: iso(modifiedAt),
      trigger: { kind: template.kind, label: template.trigger },
      connectors: template.connectors,
      portalUrl: `https://make.powerautomate.com/environments/${DEMO_ENVIRONMENT_ID}/flows/${id}/details`,
    };

    const permissions = createPermissions(random, flow, activeHumans, humans);
    const health = pickHealth(random, flow, nowMs);
    const runsUntil = state === "enabled" ? nowMs : stateChangedAt;

    flows.push(flow);
    permissionsByFlow.set(id, permissions);
    runsByFlow.set(id, createRuns(random, flow, template, health, runsUntil, nowMs));
  }

  return { people, flows, runsByFlow, permissionsByFlow };
}

function createPeople(random: Random): Person[] {
  const humans: Person[] = PEOPLE.map((name) => ({
    id: random.guid(),
    displayName: name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@${DEMO_DOMAIN}`,
    department: random.pick(DEPARTMENTS),
    status: "active" as const,
  }));

  // Three leavers whose accounts were disabled and one that was deleted.
  const [deleted, ...disabled] = random.sample(humans, 4);
  deleted.status = "deleted";
  disabled.forEach((person) => (person.status = "disabled"));

  const services: Person[] = SERVICE_ACCOUNTS.map((alias) => ({
    id: random.guid(),
    displayName: alias,
    email: `${alias}@${DEMO_DOMAIN}`,
    department: null,
    status: "active" as const,
  }));

  return [...humans, ...services];
}

function pickState(random: Random): FlowState {
  const roll = random.next();
  if (roll < 0.82) return "enabled";
  if (roll < 0.95) return "disabled";
  return "suspended";
}

function createPermissions(
  random: Random,
  flow: Flow,
  activeHumans: Person[],
  allHumans: Person[],
): Permission[] {
  const permissions: Permission[] = [{ id: flow.owner.id, role: "Owner", principal: flow.owner }];

  // Flows of leavers: in about half of them nobody else can manage them.
  const leaverWithoutBackup = flow.owner.status !== "active" && random.chance(0.55);
  const coOwnerPool = leaverWithoutBackup
    ? allHumans.filter((person) => person.status !== "active")
    : activeHumans;
  const coOwners = random
    .sample(coOwnerPool, random.int(leaverWithoutBackup ? 0 : 1, 3))
    .filter((person) => person.id !== flow.owner.id);

  for (const person of coOwners) {
    const role: PermissionRole = leaverWithoutBackup
      ? random.pick(["Owner", "CanView"] as const)
      : random.pick(["Owner", "CanEdit", "CanEdit", "CanView"] as const);
    permissions.push({ id: person.id, role, principal: person });
  }

  // A disabled co-owner must never make an otherwise orphaned flow look managed.
  if (leaverWithoutBackup) {
    return permissions.map((permission) =>
      permission.principal.status === "active" && permission.role !== "CanView"
        ? { ...permission, role: "CanView" }
        : permission,
    );
  }

  return permissions;
}

function pickHealth(random: Random, flow: Flow, nowMs: number): Health {
  if (flow.owner.status !== "active") {
    return { kind: "broken", since: nowMs - random.int(3, 20) * DAY, error: ORPHAN_ERROR };
  }

  const roll = random.next();
  // Most real flows never fail in a given week; a minority are noisy.
  if (roll < 0.74) {
    return { kind: "healthy", failRate: random.chance(0.7) ? 0 : random.next() * 0.01 };
  }
  if (roll < 0.93) return { kind: "flaky", failRate: 0.03 + random.next() * 0.12 };

  return {
    kind: "broken",
    since: nowMs - random.int(1, 12) * DAY,
    error: pickError(random, flow.connectors),
  };
}

function pickError(random: Random, connectors: string[]): ErrorTemplate {
  const fitting = ERRORS.filter(
    (error) => !error.connector || connectors.includes(error.connector),
  );
  return random.pick(fitting);
}

function runsPerDay(random: Random, template: FlowTemplate): number {
  const label = template.trigger;
  if (template.kind === "instant") return 0.2 + random.next();
  if (template.kind === "automated") return 1 + random.next() * 8;
  if (label.includes("1 hour")) return 24;
  if (label.includes("6 hours")) return 4;
  if (label.includes("week") || /Monday|Friday/.test(label)) return 1 / 7;
  if (label.includes("month")) return 1 / 30;
  return 1;
}

function createRuns(
  random: Random,
  flow: Flow,
  template: FlowTemplate,
  health: Health,
  untilMs: number,
  nowMs: number,
): Run[] {
  const perDay = runsPerDay(random, template);
  const intervalMs = DAY / perDay;
  const historyStart = Math.max(nowMs - HISTORY_DAYS * DAY, Date.parse(flow.createdAt));
  const baseDurationMs = random.int(2, 90) * 1000;
  const regular = template.kind === "recurrence";

  const runs: Run[] = [];
  let startMs = untilMs - random.next() * intervalMs;

  while (startMs > historyStart && runs.length < MAX_RUNS_PER_FLOW) {
    runs.push(createRun(random, flow, health, startMs, baseDurationMs, nowMs));
    const gap = regular ? intervalMs : intervalMs * (0.2 + random.next() * 1.6);
    startMs -= gap;
  }

  return runs;
}

function createRun(
  random: Random,
  flow: Flow,
  health: Health,
  startMs: number,
  baseDurationMs: number,
  nowMs: number,
): Run {
  const durationMs = Math.round(baseDurationMs * (0.6 + random.next() * 0.9));
  const id = `08584${random.int(100000000, 999999999)}${random.int(1000000, 9999999)}CU${random.int(10, 99)}`;
  const startTime = iso(startMs);

  if (nowMs - startMs < durationMs && flow.state === "enabled") {
    return {
      id,
      flowId: flow.id,
      status: "Running",
      startTime,
      endTime: null,
      durationMs: null,
      error: null,
    };
  }

  const endTime = iso(startMs + durationMs);
  let error: RunError | null = null;

  if (health.kind === "broken" && startMs >= health.since) {
    if (random.chance(0.9)) error = toRunError(health.error);
  } else {
    const failRate = health.kind === "broken" ? 0.02 : health.failRate;
    if (random.chance(failRate)) error = toRunError(pickError(random, flow.connectors));
  }

  if (!error && random.chance(0.008)) {
    return {
      id,
      flowId: flow.id,
      status: "Cancelled",
      startTime,
      endTime,
      durationMs,
      error: null,
    };
  }

  return {
    id,
    flowId: flow.id,
    status: error ? "Failed" : "Succeeded",
    startTime,
    endTime,
    // Failed runs usually stop early.
    durationMs: error ? Math.round(durationMs * 0.4) : durationMs,
    error,
  };
}

function toRunError(template: ErrorTemplate): RunError {
  return { code: template.code, message: template.message, action: template.action };
}

function uniqueName(
  random: Random,
  template: FlowTemplate,
  ownerDepartment: string | null,
  used: Set<string>,
): string {
  // Owner's department first, then other departments/suffixes, then a number.
  for (let attempt = 0; attempt < 30; attempt++) {
    const department =
      attempt === 0 && ownerDepartment ? ownerDepartment : random.pick(DEPARTMENTS);
    const candidate = `${department} - ${template.name}${random.pick(SUFFIXES)}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = `${template.name} #${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}
