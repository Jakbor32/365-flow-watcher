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

interface Loaded {
  flows: FlowWithHealth[];
  /** Newest first, up to HEALTH_RUNS per flow; reused by run history and insights. */
  runs: Map<string, Run[]>;
}

const cache = new Map<string, { expires: number; data: Promise<Loaded> }>();

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
    return (await this.loaded()).flows;
  }

  private loaded(): Promise<Loaded> {
    const key = this.cacheKey();
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.data;
    const data = this.loadFlows();
    for (const [staleKey, entry] of cache) if (entry.expires <= Date.now()) cache.delete(staleKey);
    cache.set(key, { expires: Date.now() + CACHE_MS, data });
    data.catch(() => cache.delete(key));
    return data;
  }

  private async loadFlows(): Promise<Loaded> {
    const { flowToken, graphToken, config, creatorIds } = this.ctx;
    const started = Date.now();
    const index = await requestPaged(
      this.url("/v2/flows", { $top: "250", includeSoftDeletedFlows: "false" }),
      flowToken,
      "Flow Service",
      30,
    );

    const inScope = (creator: string | null) =>
      creatorIds === null || (creator !== null && creatorIds.has(creator));

    // Scope first, using the creator from the index, so a big environment
    // never turns into one detail call per flow. Only flows without a creator
    // in the index need their details to be scoped at all.
    const candidates = index.filter((item) => {
      const creator = creatorIdOf(item);
      return creator === null || inScope(creator);
    });

    let detailCalls = 0;
    const raws = await mapConcurrent(candidates, CONCURRENCY, async (item) => {
      const properties = asRecord(asRecord(item)?.properties);
      const id = flowIdOf(item);
      if (!id || (creatorIdOf(item) && properties?.connectionReferences)) return item;
      detailCalls++;
      return requestJson(this.url(`/flows/${id}`, { includeFlowDefinition: "false" }), flowToken, {
        service: "Flow Service",
      });
    });

    const scoped = raws.filter((raw) => {
      const creator = creatorIdOf(raw);
      return creator !== null && inScope(creator);
    });

    const runsByFlow = new Map<string, Run[]>();
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
      runsByFlow.set(flow.id, runs);
      // Only an inactive owner can make a flow orphaned; skip the call otherwise.
      const permissions = flow.owner.status === "active" ? [] : await this.listPermissions(flow.id);
      return withHealth(flow, runs, permissions, now);
    }).then((flows) => {
      // Sizes and timing only: no names, IDs or tokens.
      console.info(
        JSON.stringify({
          type: "inventory",
          indexed: index.length,
          inScope: flows.length,
          detailCalls,
          ms: Date.now() - started,
        }),
      );
      return { flows, runs: runsByFlow };
    });
  }

  async getFlow(flowId: string) {
    return (await this.listFlows()).find((flow) => flow.id === flowId) ?? null;
  }

  async listRuns(flowId: string, limit: number): Promise<Run[]> {
    const { flows, runs } = await this.loaded();
    if (!flows.some((flow) => flow.id === flowId))
      throw new NotFoundError(`Flow ${flowId} not found`);
    // The inventory load already read the latest runs; only go back for more.
    const known = runs.get(flowId);
    if (known && (limit <= known.length || known.length < HEALTH_RUNS))
      return known.slice(0, limit);
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
