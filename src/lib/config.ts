import "server-only";

// All configuration is read at runtime from process.env, never inlined at
// build time, so one Docker image works for any tenant. Every variable is
// documented in docs/configuration.md.

export interface LiveConfig {
  mode: "live";
  tenantId: string;
  clientId: string;
  appUrl: string;
  environmentId: string;
  /** Empty = every flow in the environment. */
  watchedFlowAccounts: string[];
  /** Empty = anyone who can sign in (gate with Entra "Assignment required"). */
  dashboardUsers: string[];
  accessManagers: string[];
  previewManagers: string[];
  enableGrantAccess: boolean;
}

export interface DemoConfig {
  mode: "demo";
}

export type AppConfig = DemoConfig | LiveConfig;

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join("\n- ")}`);
  }
}

type Env = Record<string, string | undefined>;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENVIRONMENT_ID = /^(Default-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseConfig(env: Env): AppConfig {
  if (parseBoolean(env.DEMO_MODE)) {
    return { mode: "demo" };
  }

  const problems: string[] = [];
  const required = (name: string, pattern?: RegExp, hint?: string) => {
    const value = env[name]?.trim() ?? "";
    if (!value) {
      problems.push(`${name} is required (or set DEMO_MODE=true)`);
    } else if (pattern && !pattern.test(value)) {
      problems.push(`${name} has an invalid format${hint ? `, expected ${hint}` : ""}`);
    }
    return value;
  };

  const tenantId = required("AZURE_TENANT_ID", GUID, "a GUID");
  const clientId = required("AZURE_CLIENT_ID", GUID, "a GUID");
  const environmentId = required(
    "POWER_PLATFORM_ENVIRONMENT_ID",
    ENVIRONMENT_ID,
    "a GUID, optionally prefixed with 'Default-'",
  );
  const appUrl = required("APP_URL").replace(/\/+$/, "");

  if (appUrl && !/^https?:\/\//.test(appUrl)) {
    problems.push("APP_URL must start with http:// or https://");
  } else if (appUrl.startsWith("http://") && !isLocalUrl(appUrl)) {
    problems.push("APP_URL must use https:// unless it points at localhost");
  }

  const list = (name: string) => {
    const values = parseList(env[name]);
    const invalid = values.filter((value) => !EMAIL.test(value));
    if (invalid.length > 0) {
      problems.push(`${name} contains values that are not emails/UPNs: ${invalid.join(", ")}`);
    }
    return values;
  };

  const accessManagers = list("ACCESS_MANAGERS");
  const previewManagers = list("PREVIEW_MANAGERS");
  const enableGrantAccess = parseBoolean(env.ENABLE_GRANT_ACCESS);

  if (enableGrantAccess && accessManagers.length === 0) {
    problems.push("ENABLE_GRANT_ACCESS=true requires at least one ACCESS_MANAGERS entry");
  }

  const config: LiveConfig = {
    mode: "live",
    tenantId,
    clientId,
    appUrl,
    environmentId,
    watchedFlowAccounts: list("WATCHED_FLOW_ACCOUNTS"),
    dashboardUsers: list("DASHBOARD_USERS"),
    accessManagers,
    previewManagers: previewManagers.length > 0 ? previewManagers : accessManagers,
    enableGrantAccess,
  };

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return config;
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  cached ??= parseConfig(process.env);
  return cached;
}

/** The subset that is safe to send to the browser. */
export interface PublicConfig {
  mode: "demo" | "live";
  tenantId: string | null;
  clientId: string | null;
  appUrl: string | null;
}

export function toPublicConfig(config: AppConfig): PublicConfig {
  return config.mode === "demo"
    ? { mode: "demo", tenantId: null, clientId: null, appUrl: null }
    : { mode: "live", tenantId: config.tenantId, clientId: config.clientId, appUrl: config.appUrl };
}

function parseBoolean(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function parseList(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(/[,;\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function isLocalUrl(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
