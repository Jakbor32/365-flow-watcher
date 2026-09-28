// Core domain model. Both the demo generator and the live Power Automate
// adapter produce these shapes, so the UI never knows which one it talks to.

export type FlowState = "enabled" | "disabled" | "suspended";

export type TriggerKind = "recurrence" | "automated" | "instant";

/** Entra ID account status, used to detect orphaned flows. */
export type AccountStatus = "active" | "disabled" | "deleted";

export interface Person {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  status: AccountStatus;
}

export interface Flow {
  id: string;
  displayName: string;
  environmentId: string;
  state: FlowState;
  owner: Person;
  createdAt: string;
  modifiedAt: string;
  trigger: {
    kind: TriggerKind;
    /** Human readable, e.g. "Every 1 hour" or "When an item is created". */
    label: string;
  };
  connectors: string[];
  portalUrl: string;
}

export type RunStatus = "Succeeded" | "Failed" | "Cancelled" | "Running";

export interface RunError {
  code: string;
  message: string;
  /** Name of the action that failed, when known. */
  action: string | null;
}

export interface Run {
  id: string;
  flowId: string;
  status: RunStatus;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  error: RunError | null;
}

export type PermissionRole = "Owner" | "CanEdit" | "CanView";

export interface Permission {
  id: string;
  role: PermissionRole;
  principal: Person;
}
