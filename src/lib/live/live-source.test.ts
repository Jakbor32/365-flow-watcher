import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseConfig, type LiveConfig } from "@/lib/config";
import { LiveDataSource } from "./live-source";

// Fixtures follow the shapes the Flow Service admin API and Graph return.
const ENV = "Default-11111111-1111-4111-8111-111111111111";
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // active
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // disabled, left the company
const GONE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // deleted from Entra
const FLOW_A = "0a000000-0000-4000-8000-00000000000a";
const FLOW_B = "0b000000-0000-4000-8000-00000000000b";
const FLOW_C = "0c000000-0000-4000-8000-00000000000c";

const config = parseConfig({
  AZURE_TENANT_ID: "11111111-1111-4111-8111-111111111111",
  AZURE_CLIENT_ID: "22222222-2222-4222-8222-222222222222",
  POWER_PLATFORM_ENVIRONMENT_ID: ENV,
  APP_URL: "http://localhost:3000",
}) as LiveConfig;

const hour = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * hour).toISOString();

const flow = (id: string, name: string, creator: string, state = "Started") => ({
  name: id,
  id: `/providers/Microsoft.ProcessSimple/environments/${ENV}/flows/${id}`,
  properties: {
    displayName: name,
    state,
    createdTime: ago(2000),
    lastModifiedTime: ago(100),
    creator: { objectId: creator, userId: creator, tenantId: "t" },
    definitionSummary: { triggers: [{ type: "Recurrence" }] },
    connectionReferences: {
      shared_sharepointonline: {
        api: { name: "shared_sharepointonline", displayName: "SharePoint" },
      },
      shared_office365: { api: { name: "shared_office365", displayName: "Office 365 Outlook" } },
    },
  },
});

const run = (
  name: string,
  status: string,
  hoursAgo: number,
  error?: { code: string; message: string },
) => ({
  name,
  properties: {
    status,
    startTime: ago(hoursAgo),
    endTime: ago(hoursAgo - 0.01),
    ...(error ? { error } : {}),
  },
});

const permission = (principal: string, roleName: string) => ({
  name: `perm-${principal}`,
  properties: { roleName, principal: { id: principal, type: "User" } },
});

const users: Record<string, object> = {
  [ALICE]: {
    id: ALICE,
    displayName: "Alice",
    mail: "alice@contoso.com",
    userPrincipalName: "alice@contoso.com",
    accountEnabled: true,
  },
  [BOB]: {
    id: BOB,
    displayName: "Bob",
    mail: "bob@contoso.com",
    userPrincipalName: "bob@contoso.com",
    accountEnabled: false,
  },
};

let calls: { method: string; url: string; body: unknown }[] = [];
let accountEnabledForbidden = false;

function respond(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), { status });
}

beforeEach(() => {
  calls = [];
  accountEnabledForbidden = false;
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: init?.method ?? "GET", url: url.pathname + url.search, body });
    const path = url.pathname;

    if (path.endsWith("/v2/flows")) {
      return respond({
        value: [
          flow(FLOW_A, "Invoice approval", ALICE),
          flow(FLOW_B, "Offboarding", BOB),
          flow(FLOW_C, "Old sync", GONE, "Stopped"),
        ],
      });
    }
    if (path.endsWith("/runs")) {
      if (path.includes(FLOW_A))
        return respond({
          value: [
            run("r1", "Succeeded", 1),
            run("r2", "Failed", 3, { code: "NotFound", message: "Item Not Found" }),
          ],
        });
      if (path.includes(FLOW_B))
        return respond({
          value: [
            run("r3", "Failed", 2, {
              code: "ConnectionAuthorizationFailed",
              message: "Re-authenticate",
            }),
          ],
        });
      return respond(null, 204);
    }
    if (path.endsWith("/permissions")) {
      if (path.includes(FLOW_B))
        return respond({ value: [permission(BOB, "Owner"), permission(ALICE, "CanView")] });
      return respond({ value: [permission(GONE, "Owner")] });
    }
    if (path.endsWith("/modifyPermissions")) return respond(null, 200);
    if (path === "/v1.0/$batch") {
      const requests = (body as { requests: { id: string; url: string }[] }).requests;
      return respond({
        responses: requests.map((request) => {
          const id = request.url.split("/")[2].split("?")[0];
          if (accountEnabledForbidden && request.url.includes("accountEnabled"))
            return { id: request.id, status: 403, body: {} };
          const user = users[id] as Record<string, unknown> | undefined;
          if (!user) return { id: request.id, status: 404, body: {} };
          // Graph returns only the $select-ed fields.
          const { accountEnabled, ...basic } = user;
          const body = request.url.includes("accountEnabled")
            ? { ...basic, accountEnabled }
            : basic;
          return { id: request.id, status: 200, body };
        }),
      });
    }
    if (path.startsWith("/v1.0/users/")) {
      const key = decodeURIComponent(path.split("/")[3]);
      const user = Object.values(users).find(
        (candidate) => (candidate as { mail: string }).mail === key,
      );
      return user ? respond(user) : respond({ error: { code: "Request_ResourceNotFound" } }, 404);
    }
    return respond({ error: { code: "Unexpected", message: path } }, 500);
  });
});

afterEach(() => vi.unstubAllGlobals());

const source = (creatorIds: Set<string> | null = null, actorId = crypto.randomUUID()) =>
  new LiveDataSource({ config, flowToken: "flow", graphToken: "graph", actorId, creatorIds });

describe("LiveDataSource", () => {
  it("builds the inventory with owners, health and orphans", async () => {
    const flows = await source().listFlows();
    const byId = new Map(flows.map((flow) => [flow.id, flow]));

    const a = byId.get(FLOW_A)!;
    expect(a).toMatchObject({
      displayName: "Invoice approval",
      state: "enabled",
      recentRuns: 2,
      recentFailures: 1,
      orphaned: false,
    });
    expect(a.owner).toMatchObject({ displayName: "Alice", status: "active" });
    expect(a.connectors).toEqual(["Office 365 Outlook", "SharePoint"]);
    expect(a.trigger.kind).toBe("recurrence");

    // Bob is disabled and Alice can only view: nobody active can manage it.
    expect(byId.get(FLOW_B)).toMatchObject({ orphaned: true, owner: { status: "disabled" } });
    // The creator no longer exists in Graph at all.
    expect(byId.get(FLOW_C)).toMatchObject({
      orphaned: true,
      state: "disabled",
      recentRuns: 0,
      owner: { status: "deleted" },
    });
  });

  it("only reads permissions for flows whose owner left", async () => {
    await source().listFlows();
    const permissionCalls = calls.filter((call) => call.url.includes("/permissions"));
    expect(permissionCalls.map((call) => call.url)).not.toContainEqual(
      expect.stringContaining(FLOW_A),
    );
    expect(permissionCalls).toHaveLength(2);
  });

  it("filters to the watched creators", async () => {
    const flows = await source(new Set([ALICE])).listFlows();
    expect(flows.map((flow) => flow.id)).toEqual([FLOW_A]);
  });

  it("keeps working without User.Read.All (disabled owners then look active)", async () => {
    accountEnabledForbidden = true;
    const flows = await source().listFlows();
    expect(flows.find((flow) => flow.id === FLOW_B)?.owner.status).toBe("active");
    expect(flows.find((flow) => flow.id === FLOW_C)?.owner.status).toBe("deleted");
  });

  it("caches per user and never across users", async () => {
    const shared = "same-user";
    await source(null, shared).listFlows();
    const first = calls.length;
    await source(null, shared).listFlows();
    expect(calls.length).toBe(first);
    await source(null, "another-user").listFlows();
    expect(calls.length).toBeGreaterThan(first);
  });

  it("maps run errors and statuses", async () => {
    const runs = await source().listRuns(FLOW_A, 10);
    expect(runs[0].status).toBe("Succeeded");
    expect(runs[1]).toMatchObject({
      status: "Failed",
      error: { code: "NotFound", message: "Item Not Found" },
    });
  });

  it("sends the grant and revoke bodies modifyPermissions expects", async () => {
    const live = source();
    const result = await live.grantAccess(FLOW_B, "alice@contoso.com");
    await live.revokeAccess(FLOW_B, ALICE);

    const [grant, revoke] = calls.filter((call) => call.url.includes("modifyPermissions"));
    expect(grant.method).toBe("POST");
    expect(grant.body).toEqual({
      put: [
        {
          properties: {
            principal: {
              id: ALICE,
              type: "User",
              email: "alice@contoso.com",
              displayName: "Alice",
            },
            roleName: "CanEdit",
          },
        },
      ],
    });
    expect(revoke.body).toEqual({ delete: [{ id: ALICE }] });
    expect(result).toMatchObject({ simulated: false, permission: { id: ALICE, role: "CanEdit" } });
  });

  it("uses the admin scope of the configured environment", async () => {
    await source().listFlows();
    expect(calls[0].url).toContain(`/scopes/admin/environments/${ENV}/v2/flows`);
    expect(calls[0].url).toContain("api-version=2016-11-01");
  });
});
