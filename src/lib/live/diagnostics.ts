import "server-only";
import type { AppConfig, LiveConfig } from "@/lib/config";
import { findPersonByEmail, getMe } from "./graph";
import {
  FLOW_API,
  FLOW_API_VERSION,
  GRAPH_API,
  UpstreamError,
  asRecord,
  requestJson,
} from "./http";
import { FLOW_AUDIENCES, GRAPH_AUDIENCES, readClaims, type TokenClaims } from "./tokens";

export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** What to do when it isn't passing; links to the setup step. */
  fix?: string;
}

const FLOW_SCOPES = ["User", "Flows.Read.All", "Activity.Read.All"];
const GRAPH_SCOPES = ["User.Read", "User.ReadBasic.All"];
const STEP_1 = "docs/setup/1-entra-app.md";
const STEP_2 = "docs/setup/2-environment.md";

/**
 * Runs every check independently, so one failure never hides the others.
 * Only reads: nothing here changes the tenant.
 */
export async function runDiagnostics(
  config: AppConfig,
  tokens: { flow: string | null; graph: string | null },
): Promise<Check[]> {
  if (config.mode === "demo") {
    return [
      {
        id: "mode",
        label: "Demo mode",
        status: "warn",
        detail:
          "DEMO_MODE=true: fictional data, no Microsoft sign-in. Set it to false to connect a tenant.",
      },
    ];
  }

  const checks: Check[] = [
    {
      id: "config",
      label: "Configuration",
      status: "pass",
      // No tenant details before the tokens are checked: this endpoint has no access gate.
      detail: "All required variables are set.",
    },
  ];

  if (!tokens.flow || !tokens.graph) {
    checks.push({
      id: "tokens",
      label: "Signed in",
      status: "fail",
      detail: "No tokens were sent.",
      fix: "Sign in again.",
    });
    return checks;
  }

  const flow = readClaims(tokens.flow);
  const graph = readClaims(tokens.graph);
  checks.push(tokenCheck("flow-token", "Flow Service token", flow, FLOW_AUDIENCES, config));
  checks.push(tokenCheck("graph-token", "Graph token", graph, GRAPH_AUDIENCES, config));
  checks.push(scopeCheck("flow-scopes", "Power Automate permissions", flow, FLOW_SCOPES));
  checks.push(scopeCheck("graph-scopes", "Graph permissions", graph, GRAPH_SCOPES));

  const [identity, flowAccess] = await Promise.all([
    identityChecks(tokens.graph, graph, config),
    flowAdminCheck(tokens.flow, config),
  ]);
  checks.push(...identity, flowAccess);
  checks.push(...(await watchedAccountsCheck(tokens.graph, config)));
  return checks;
}

function tokenCheck(
  id: string,
  label: string,
  claims: TokenClaims | null,
  audiences: string[],
  config: LiveConfig,
): Check {
  if (!claims)
    return {
      id,
      label,
      status: "fail",
      detail: "Not a valid token.",
      fix: "Sign out and sign in again.",
    };
  if (!audiences.includes(claims.aud ?? "")) {
    return {
      id,
      label,
      status: "fail",
      detail: `Wrong audience: ${claims.aud}.`,
      fix: "Sign out and sign in again.",
    };
  }
  if (claims.tid !== config.tenantId.toLowerCase()) {
    return {
      id,
      label,
      status: "fail",
      detail: `Issued by tenant ${claims.tid}, expected ${config.tenantId}.`,
      fix: `Check AZURE_TENANT_ID (${STEP_1}).`,
    };
  }
  return { id, label, status: "pass", detail: "Right tenant and audience." };
}

function scopeCheck(
  id: string,
  label: string,
  claims: TokenClaims | null,
  required: string[],
): Check {
  const granted = new Set((claims?.scopes ?? []).map((scope) => scope.toLowerCase()));
  const missing = required.filter((scope) => !granted.has(scope.toLowerCase()));
  return missing.length === 0
    ? { id, label, status: "pass", detail: required.join(", ") }
    : {
        id,
        label,
        status: "fail",
        detail: `Missing: ${missing.join(", ")}.`,
        fix: `Add them as delegated permissions and grant admin consent (${STEP_1}).`,
      };
}

async function identityChecks(
  graphToken: string,
  claims: TokenClaims | null,
  config: LiveConfig,
): Promise<Check[]> {
  let me;
  try {
    me = await getMe(graphToken);
  } catch (error) {
    return [
      {
        id: "me",
        label: "Microsoft Graph",
        status: "fail",
        detail: message(error),
        fix: `Check Graph permissions (${STEP_1}).`,
      },
    ];
  }

  const checks: Check[] = [
    { id: "me", label: "Microsoft Graph", status: "pass", detail: `Signed in as ${me.upn}.` },
  ];

  const allowed = config.dashboardUsers.length === 0 || config.dashboardUsers.includes(me.upn);
  checks.push(
    allowed
      ? {
          id: "dashboard-users",
          label: "Dashboard access",
          status: config.dashboardUsers.length === 0 ? "warn" : "pass",
          detail:
            config.dashboardUsers.length === 0
              ? "DASHBOARD_USERS is empty: anyone who can sign in may use the app."
              : "You are in DASHBOARD_USERS.",
          fix:
            config.dashboardUsers.length === 0
              ? `Fine if Entra "Assignment required" is on (${STEP_1}).`
              : undefined,
        }
      : {
          id: "dashboard-users",
          label: "Dashboard access",
          status: "fail",
          detail: `${me.upn} is not in DASHBOARD_USERS.`,
          fix: "Add your UPN to DASHBOARD_USERS.",
        },
  );

  // accountEnabled needs User.Read.All; without it disabled owners look active.
  const hasReadAll =
    claims?.scopes.some((scope) => scope.toLowerCase() === "user.read.all") ?? false;
  let status: CheckStatus = "warn";
  let detail = "User.Read.All not granted: only deleted owners are detected, not disabled ones.";
  try {
    const user = asRecord(
      await requestJson(`${GRAPH_API}/users/${me.id}?$select=accountEnabled`, graphToken, {
        service: "Microsoft Graph",
      }),
    );
    if (typeof user?.accountEnabled === "boolean") {
      status = "pass";
      detail = "accountEnabled is readable, disabled owners are detected.";
    }
  } catch {
    // Keep the warning.
  }
  if (status === "warn" && hasReadAll) {
    detail = "User.Read.All is in the token, but accountEnabled could not be read.";
  }
  checks.push({
    id: "account-status",
    label: "Owner account status",
    status,
    detail,
    fix:
      status === "pass"
        ? undefined
        : `Optional: add Graph User.Read.All and grant admin consent (${STEP_1}).`,
  });

  const manager = config.accessManagers.includes(me.upn);
  checks.push({
    id: "grant-access",
    label: "Grant access",
    status: "pass",
    detail: !config.enableGrantAccess
      ? "Off (ENABLE_GRANT_ACCESS=false). The app never writes to your tenant."
      : manager
        ? "On, and you are in ACCESS_MANAGERS."
        : "On, but you are not in ACCESS_MANAGERS, so you can't use it.",
  });

  return checks;
}

async function flowAdminCheck(flowToken: string, config: LiveConfig): Promise<Check> {
  const url = new URL(
    `${FLOW_API}/providers/Microsoft.ProcessSimple/scopes/admin/environments/${encodeURIComponent(config.environmentId)}/v2/flows`,
  );
  url.searchParams.set("api-version", FLOW_API_VERSION);
  url.searchParams.set("$top", "1");
  try {
    await requestJson(url.toString(), flowToken, { service: "Flow Service" });
    return {
      id: "flow-admin",
      label: "Flow admin access",
      status: "pass",
      detail: `Flows in ${config.environmentId} are readable.`,
    };
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 0;
    return {
      id: "flow-admin",
      label: "Flow admin access",
      status: "fail",
      detail: message(error),
      fix:
        status === 403
          ? `Your account needs Power Platform Administrator or System Administrator in this environment (${STEP_2}).`
          : status === 404
            ? `Check POWER_PLATFORM_ENVIRONMENT_ID (${STEP_2}).`
            : undefined,
    };
  }
}

async function watchedAccountsCheck(graphToken: string, config: LiveConfig): Promise<Check[]> {
  if (config.watchedFlowAccounts.length === 0) return [];
  const results = await Promise.all(
    config.watchedFlowAccounts.map(
      async (email) =>
        [email, await findPersonByEmail(graphToken, email).catch(() => null)] as const,
    ),
  );
  const missing = results.filter(([, person]) => person === null).map(([email]) => email);
  return [
    missing.length === 0
      ? {
          id: "watched",
          label: "Watched accounts",
          status: "pass",
          detail: `${results.length} found in Entra ID.`,
        }
      : {
          id: "watched",
          label: "Watched accounts",
          status: "fail",
          detail: `Not found: ${missing.join(", ")}.`,
          fix: "Fix WATCHED_FLOW_ACCOUNTS.",
        },
  ];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
