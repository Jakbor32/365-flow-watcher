import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "@/lib/config";
import { runDiagnostics } from "./diagnostics";

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const config = parseConfig({
  AZURE_TENANT_ID: TENANT,
  AZURE_CLIENT_ID: "22222222-2222-4222-8222-222222222222",
  POWER_PLATFORM_ENVIRONMENT_ID: TENANT,
  APP_URL: "http://localhost:3000",
  DASHBOARD_USERS: "alice@contoso.com",
});

const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = (claims: Record<string, unknown>) => {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none" })}.${part(claims)}.sig`;
};
const flowToken = (scp: string) =>
  jwt({ aud: "https://service.flow.microsoft.com/", tid: TENANT, oid: USER, exp, scp });
const graphToken = (scp = "User.Read User.ReadBasic.All") =>
  jwt({ aud: "00000003-0000-0000-c000-000000000000", tid: TENANT, oid: USER, exp, scp });

let flowAdminStatus = 200;

beforeEach(() => {
  flowAdminStatus = 200;
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1.0/me") {
      return Response.json({
        id: USER,
        userPrincipalName: "alice@contoso.com",
        displayName: "Alice",
      });
    }
    if (url.pathname.startsWith("/v1.0/users/"))
      return Response.json({ error: { code: "Forbidden" } }, { status: 403 });
    if (url.pathname.endsWith("/v2/flows")) {
      return flowAdminStatus === 200
        ? Response.json({ value: [] })
        : Response.json(
            { error: { code: "Forbidden", message: "no admin" } },
            { status: flowAdminStatus },
          );
    }
    return Response.json({}, { status: 500 });
  });
});
afterEach(() => vi.unstubAllGlobals());

const byId = async (tokens: { flow: string | null; graph: string | null }) =>
  Object.fromEntries((await runDiagnostics(config, tokens)).map((check) => [check.id, check]));

describe("runDiagnostics", () => {
  it("passes the required checks on a good setup, warns about User.Read.All", async () => {
    const checks = await byId({
      flow: flowToken("User Flows.Read.All Activity.Read.All"),
      graph: graphToken(),
    });
    for (const id of [
      "flow-token",
      "graph-token",
      "flow-scopes",
      "graph-scopes",
      "me",
      "dashboard-users",
      "flow-admin",
    ]) {
      expect(checks[id].status, id).toBe("pass");
    }
    expect(checks["account-status"].status).toBe("warn");
  });

  it("names missing scopes and the missing admin role", async () => {
    flowAdminStatus = 403;
    const checks = await byId({ flow: flowToken("User"), graph: graphToken() });
    expect(checks["flow-scopes"]).toMatchObject({
      status: "fail",
      detail: expect.stringContaining("Flows.Read.All"),
    });
    expect(checks["flow-admin"]).toMatchObject({
      status: "fail",
      fix: expect.stringContaining("Power Platform Administrator"),
    });
  });

  it("stops early and reveals nothing without tokens", async () => {
    const checks = await runDiagnostics(config, { flow: null, graph: null });
    expect(checks.map((check) => check.id)).toEqual(["config", "tokens"]);
    expect(JSON.stringify(checks)).not.toContain(TENANT);
  });
});
