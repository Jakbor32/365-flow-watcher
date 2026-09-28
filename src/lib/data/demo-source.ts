import { generateDemoTenant, type DemoTenant } from "@/lib/demo/generate";
import type { Permission } from "@/lib/domain/types";
import { withHealth } from "./health";
import { NotFoundError, type DataSource, type FlowWithHealth, type GrantResult } from "./source";

/**
 * Read-only fake tenant. Grant/revoke are validated like the real thing but
 * never persisted: the demo is public, so one visitor must not change what the
 * next one sees. The client keeps the simulated change in its own state.
 */
export class DemoDataSource implements DataSource {
  private readonly tenant: DemoTenant;

  constructor(private readonly now: Date) {
    this.tenant = generateDemoTenant({ now });
  }

  async listFlows(): Promise<FlowWithHealth[]> {
    return this.tenant.flows.map((flow) =>
      withHealth(flow, this.runs(flow.id), this.permissions(flow.id), this.now),
    );
  }

  async getFlow(flowId: string): Promise<FlowWithHealth | null> {
    const flow = this.tenant.flows.find((candidate) => candidate.id === flowId);
    return flow ? withHealth(flow, this.runs(flow.id), this.permissions(flow.id), this.now) : null;
  }

  async listRuns(flowId: string, limit: number) {
    return this.runs(this.requireFlow(flowId)).slice(0, limit);
  }

  async listPermissions(flowId: string) {
    return this.permissions(this.requireFlow(flowId));
  }

  async findPerson(email: string) {
    const needle = email.trim().toLowerCase();
    return this.tenant.people.find((person) => person.email === needle) ?? null;
  }

  async grantAccess(flowId: string, email: string): Promise<GrantResult> {
    this.requireFlow(flowId);
    const person = await this.findPerson(email);

    if (!person || person.status !== "active") {
      throw new NotFoundError(`No active user ${email} in the demo tenant`);
    }

    const permission: Permission = { id: person.id, role: "CanEdit", principal: person };
    return { permission, simulated: true };
  }

  async revokeAccess(flowId: string, permissionId: string) {
    const exists = this.permissions(this.requireFlow(flowId)).some(
      (permission) => permission.id === permissionId,
    );

    if (!exists) {
      throw new NotFoundError(`Permission ${permissionId} not found on flow ${flowId}`);
    }

    return { simulated: true };
  }

  private requireFlow(flowId: string): string {
    if (!this.tenant.runsByFlow.has(flowId)) {
      throw new NotFoundError(`Flow ${flowId} not found`);
    }
    return flowId;
  }

  private runs(flowId: string) {
    return this.tenant.runsByFlow.get(flowId) ?? [];
  }

  private permissions(flowId: string) {
    return this.tenant.permissionsByFlow.get(flowId) ?? [];
  }
}

/**
 * Demo "now", truncated to the hour so every request within that hour sees
 * the same tenant (list and detail views agree) while dates never look stale.
 */
export function demoNow(date = new Date()): Date {
  const hour = 3_600_000;
  return new Date(Math.floor(date.getTime() / hour) * hour);
}
