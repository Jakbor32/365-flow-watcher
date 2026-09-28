import "server-only";
import type { LiveConfig } from "@/lib/config";
import { withHealth } from "@/lib/data/health";
import { NotFoundError, type DataSource, type GrantResult } from "@/lib/data/source";
import type { FlowWithHealth, Permission, Person, Run } from "@/lib/domain/types";
import { deletedPerson, findPersonByEmail, getPeople, searchPeople } from "./graph";
import {
  FLOW_API,
  FLOW_API_VERSION,
  asRecord,
  mapConcurrent,
  requestJson,
  requestPaged,
} from "./http";
import {
  creatorIdOf,
  flowIdOf,
  normalizeFlow,
  normalizePermission,
  normalizeRun,
  principalIdsOf,
} from "./normalize";

const CONCURRENCY = 8;
/** Runs read per flow for the health columns and sparkline. */
const HEALTH_RUNS = 100;
const CACHE_MS = 120_000;

export interface LiveContext {
  config: LiveConfig;
  flowToken: string;
  graphToken: string;
  /** Signed-in user's object ID: the cache is per user, never shared. */
  actorId: string;
  /** Only flows created by these object IDs; null = every flow. */
  creatorIds: Set<string> | null;
}

const cache = new Map<string, { expires: number; flows: Promise<FlowWithHealth[]> }>();

export class LiveDataSource implements DataSource {
  constructor(private readonly ctx: LiveContext) {}

  private get env() {
    return `${FLOW_API}/providers/Microsoft.ProcessSimple/scopes/admin/environments/${encodeURIComponent(this.ctx.config.environmentId)}`;
  }

  private url(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.env}${path}`);
    url.searchParams.set("api-version", FLOW_API_VERSION);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }

  private cacheKey() {
    const scope = this.ctx.creatorIds ? [...this.ctx.creatorIds].sort().join(",") : "all";
    return `${this.ctx.actorId}|${scope}`;
  }

  async listFlows(): Promise<FlowWithHealth[]> {
    const key = this.cacheKey();
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.flows;
    const flows = this.loadFlows();
    for (const [staleKey, entry] of cache) if (entry.expires <= Date.now()) cache.delete(staleKey);
    cache.set(key, { expires: Date.now() + CACHE_MS, flows });
    flows.catch(() => cache.delete(key));
    return flows;
  }

  private async loadFlows(): Promise<FlowWithHealth[]> {
    const { flowToken, graphToken, config, creatorIds } = this.ctx;
    const index = await requestPaged(
      this.url("/v2/flows", { $top: "250", includeSoftDeletedFlows: "false" }),
      flowToken,
      "Flow Service",
      30,
    );

    // The index usually has what we need; fetch details only when it doesn't.
    const raws = await mapConcurrent(index, CONCURRENCY, async (item) => {
      const properties = asRecord(asRecord(item)?.properties);
      const id = flowIdOf(item);
      if (!id || (creatorIdOf(item) && properties?.connectionReferences)) return item;
      return requestJson(this.url(`/flows/${id}`, { includeFlowDefinition: "false" }), flowToken, {
        service: "Flow Service",
      });
    });

    const scoped = raws.filter((raw) => {
      const creator = creatorIdOf(raw);
      return creator !== null && (creatorIds === null || creatorIds.has(creator));
    });

    const { people } = await getPeople(
      graphToken,
      scoped.map((raw) => creatorIdOf(raw)!),
    );
    const now = new Date();

    return mapConcurrent(scoped, CONCURRENCY, async (raw) => {
      const creator = creatorIdOf(raw)!;
      const flow = normalizeFlow(
        raw,
        config.environmentId,
        people.get(creator) ?? deletedPerson(creator),
      )!;
      const runs = await this.fetchRuns(flow.id, HEALTH_RUNS);
      // Only an inactive owner can make a flow orphaned; skip the call otherwise.
      const permissions = flow.owner.status === "active" ? [] : await this.listPermissions(flow.id);
      return withHealth(flow, runs, permissions, now);
    });
  }

  async getFlow(flowId: string) {
    return (await this.listFlows()).find((flow) => flow.id === flowId) ?? null;
  }

  async listRuns(flowId: string, limit: number): Promise<Run[]> {
    await this.requireFlow(flowId);
    return this.fetchRuns(flowId, limit);
  }

  private async fetchRuns(flowId: string, limit: number): Promise<Run[]> {
    const raws = await requestPaged(
      this.url(`/flows/${flowId}/runs`, { $top: String(Math.min(limit, 100)) }),
      this.ctx.flowToken,
      "Flow Service",
      Math.ceil(limit / 100),
    );
    return raws
      .map((raw) => normalizeRun(raw, flowId))
      .filter((run): run is Run => run !== null)
      .sort((a, b) => b.startTime.localeCompare(a.startTime))
      .slice(0, limit);
  }

  async listPermissions(flowId: string): Promise<Permission[]> {
    const raws = await requestPaged(
      this.url(`/flows/${flowId}/permissions`),
      this.ctx.flowToken,
      "Flow Service",
      5,
    );
    const { people } = await getPeople(this.ctx.graphToken, principalIdsOf(raws));
    return raws
      .map((raw) => normalizePermission(raw, people))
      .filter((permission): permission is Permission => permission !== null);
  }

  findPerson(email: string): Promise<Person | null> {
    return findPersonByEmail(this.ctx.graphToken, email);
  }

  searchPeople(query: string, limit: number): Promise<Person[]> {
    return searchPeople(this.ctx.graphToken, query, limit);
  }

  async grantAccess(flowId: string, email: string): Promise<GrantResult> {
    const person = await this.findPerson(email);
    if (!person) throw new NotFoundError(`No user ${email} in this tenant`);
    await this.modifyPermissions(flowId, {
      put: [
        {
          properties: {
            principal: {
              id: person.id,
              type: "User",
              email: person.email,
              displayName: person.displayName,
            },
            roleName: "CanEdit",
          },
        },
      ],
    });
    return { permission: { id: person.id, role: "CanEdit", principal: person }, simulated: false };
  }

  async revokeAccess(flowId: string, permissionId: string) {
    await this.modifyPermissions(flowId, { delete: [{ id: permissionId }] });
    return { simulated: false };
  }

  private async modifyPermissions(flowId: string, body: unknown) {
    await requestJson(this.url(`/flows/${flowId}/modifyPermissions`), this.ctx.flowToken, {
      method: "POST",
      service: "Flow Service",
      body,
    });
    // Ownership changed: drop this user's cached inventory.
    for (const key of cache.keys()) if (key.startsWith(`${this.ctx.actorId}|`)) cache.delete(key);
  }

  private async requireFlow(flowId: string) {
    if (!(await this.getFlow(flowId))) throw new NotFoundError(`Flow ${flowId} not found`);
  }
}
