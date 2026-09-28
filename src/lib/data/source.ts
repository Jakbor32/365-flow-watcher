import type { Flow, Permission, Person, Run } from "@/lib/domain/types";

export interface FlowWithHealth extends Flow {
  lastRun: Run | null;
  /** Runs in the lookback window that the source returned. */
  recentRuns: number;
  recentFailures: number;
  orphaned: boolean;
}

export interface GrantResult {
  permission: Permission;
  /** True in demo mode: nothing was written anywhere. */
  simulated: boolean;
}

/**
 * Everything the app reads or writes goes through this interface.
 * `DemoDataSource` serves seeded fake data; the live source (module 5)
 * calls the Power Automate Flow Service and Microsoft Graph.
 */
export interface DataSource {
  listFlows(): Promise<FlowWithHealth[]>;
  getFlow(flowId: string): Promise<FlowWithHealth | null>;
  listRuns(flowId: string, limit: number): Promise<Run[]>;
  listPermissions(flowId: string): Promise<Permission[]>;
  grantAccess(flowId: string, email: string): Promise<GrantResult>;
  revokeAccess(flowId: string, permissionId: string): Promise<{ simulated: boolean }>;
  findPerson(email: string): Promise<Person | null>;
}

export class NotFoundError extends Error {}
