import type { FlowWithHealth, Permission, Person, Run } from "@/lib/domain/types";

export type { FlowWithHealth };

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
  /** Active users whose name or email contains `query`, for the grant picker. */
  searchPeople(query: string, limit: number): Promise<Person[]>;
}

export class NotFoundError extends Error {}
export class BadRequestError extends Error {}
export class ConflictError extends Error {}
export class ForbiddenError extends Error {}
export class UnauthorizedError extends Error {}
