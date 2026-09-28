import "server-only";
import { createHash } from "node:crypto";
import { getConfig, type AppConfig, type LiveConfig } from "@/lib/config";
import { DemoDataSource, demoNow } from "@/lib/data/demo-source";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
  type DataSource,
} from "@/lib/data/source";
import { findPersonByEmail, getMe } from "@/lib/live/graph";
import { LiveDataSource } from "@/lib/live/live-source";
import { checkTokenPair, readClaims } from "@/lib/live/tokens";
import { parseEmail } from "@/lib/access/rules";

export interface Actor {
  id: string;
  name: string;
  email: string;
}

export interface RequestContext {
  config: AppConfig;
  actor: Actor;
  source: DataSource;
  /** Account whose flows are shown instead of the normal scope (managers only). */
  previewing: string | null;
  canPreview: boolean;
}

export const DEMO_ACTOR: Actor = {
  id: "00000000-0000-4000-8000-00000000d3a0",
  name: "Demo Admin",
  email: "demo.admin@contoso.com",
};

/**
 * Who is asking and what they may see. Every API route starts here.
 * `?as=<email>` switches to another account's flows for preview managers.
 */
export async function getContext(request: Request): Promise<RequestContext> {
  const config = getConfig();
  const previewParam = new URL(request.url).searchParams.get("as");

  if (config.mode === "demo") {
    const previewing = previewParam ? parseEmail(previewParam) : null;
    const source = demoSource();
    return {
      config,
      actor: DEMO_ACTOR,
      source: previewing ? ownedBy(source, previewing) : source,
      previewing,
      canPreview: true,
    };
  }

  const { flowToken, graphToken, actor } = await authenticate(request, config);
  const canPreview = isListed(actor, config.previewManagers);
  let previewing: string | null = null;
  let creatorIds: Set<string> | null;

  if (previewParam) {
    if (!canPreview) throw new ForbiddenError("You are not in PREVIEW_MANAGERS");
    previewing = parseEmail(previewParam);
    const person = await findPersonByEmail(graphToken, previewing);
    if (!person) throw new BadRequestError(`No user ${previewing} in this tenant`);
    creatorIds = new Set([person.id]);
  } else {
    creatorIds = await watchedCreatorIds(config, graphToken);
  }

  return {
    config,
    actor,
    previewing,
    canPreview,
    source: new LiveDataSource({ config, flowToken, graphToken, actorId: actor.id, creatorIds }),
  };
}

export function isListed(actor: Actor, list: string[]): boolean {
  return list.includes(actor.email);
}

let demo: { hour: number; source: DemoDataSource } | null = null;

function demoSource(): DemoDataSource {
  const now = demoNow();
  // Regenerate once an hour so relative dates stay fresh.
  if (demo?.hour !== now.getTime()) demo = { hour: now.getTime(), source: new DemoDataSource(now) };
  return demo.source;
}

/** Demo stand-in for the live creator filter. */
function ownedBy(source: DataSource, email: string): DataSource {
  const listFlows = async () =>
    (await source.listFlows()).filter((flow) => flow.owner.email === email);
  return {
    ...bindAll(source),
    listFlows,
    getFlow: async (flowId) => (await listFlows()).find((flow) => flow.id === flowId) ?? null,
  };
}

function bindAll(source: DataSource): DataSource {
  return {
    listFlows: () => source.listFlows(),
    getFlow: (id) => source.getFlow(id),
    listRuns: (id, limit) => source.listRuns(id, limit),
    listPermissions: (id) => source.listPermissions(id),
    grantAccess: (id, email) => source.grantAccess(id, email),
    revokeAccess: (id, permissionId) => source.revokeAccess(id, permissionId),
    findPerson: (email) => source.findPerson(email),
    searchPeople: (query, limit) => source.searchPeople(query, limit),
  };
}

const identities = new Map<string, { expires: number; actor: Promise<Actor> }>();

async function authenticate(request: Request, config: LiveConfig) {
  const flowToken = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const graphToken = request.headers.get("x-graph-token");
  if (!flowToken || !graphToken) throw new UnauthorizedError("Sign in required");

  const problem = checkTokenPair(readClaims(flowToken), readClaims(graphToken), config.tenantId);
  if (problem) throw new UnauthorizedError(problem);

  // Identity comes from Graph, which verifies the token. Cached per token hash.
  const key = createHash("sha256").update(graphToken).digest("hex");
  let entry = identities.get(key);
  if (!entry || entry.expires < Date.now()) {
    for (const [staleKey, stale] of identities)
      if (stale.expires < Date.now()) identities.delete(staleKey);
    const actor = getMe(graphToken).then((me) => ({
      id: me.id,
      name: me.displayName,
      email: me.upn,
    }));
    entry = { expires: Date.now() + 5 * 60_000, actor };
    identities.set(key, entry);
    actor.catch(() => identities.delete(key));
  }
  const actor = await entry.actor;

  if (config.dashboardUsers.length > 0 && !isListed(actor, config.dashboardUsers)) {
    throw new ForbiddenError("You are not in DASHBOARD_USERS");
  }
  return { flowToken, graphToken, actor };
}

const watched = new Map<string, { expires: number; ids: Promise<Set<string>> }>();

async function watchedCreatorIds(
  config: LiveConfig,
  graphToken: string,
): Promise<Set<string> | null> {
  if (config.watchedFlowAccounts.length === 0) return null;
  const key = config.watchedFlowAccounts.join(",");
  let entry = watched.get(key);
  if (!entry || entry.expires < Date.now()) {
    const ids = Promise.all(
      config.watchedFlowAccounts.map((email) => findPersonByEmail(graphToken, email)),
    ).then(
      (people) => new Set(people.filter((person) => person !== null).map((person) => person.id)),
    );
    entry = { expires: Date.now() + 10 * 60_000, ids };
    watched.set(key, entry);
    ids.catch(() => watched.delete(key));
  }
  return entry.ids;
}
