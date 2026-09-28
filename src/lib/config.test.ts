import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig, toPublicConfig } from "./config";

const valid = {
  AZURE_TENANT_ID: "11111111-1111-4111-8111-111111111111",
  AZURE_CLIENT_ID: "22222222-2222-4222-8222-222222222222",
  POWER_PLATFORM_ENVIRONMENT_ID: "Default-11111111-1111-4111-8111-111111111111",
  APP_URL: "https://flows.example.com/",
};

function problemsOf(env: Record<string, string>): string[] {
  try {
    parseConfig(env);
    return [];
  } catch (error) {
    return (error as ConfigError).problems;
  }
}

describe("parseConfig", () => {
  it("needs nothing else in demo mode", () => {
    expect(parseConfig({ DEMO_MODE: "true" })).toEqual({ mode: "demo" });
  });

  it("parses a minimal live config", () => {
    const config = parseConfig(valid);
    expect(config).toMatchObject({
      mode: "live",
      appUrl: "https://flows.example.com",
      watchedFlowAccounts: [],
      enableGrantAccess: false,
    });
  });

  it("reports every missing variable at once", () => {
    const problems = problemsOf({});
    expect(problems).toHaveLength(4);
    expect(problems.join()).toContain("AZURE_TENANT_ID");
    expect(problems.join()).toContain("APP_URL");
  });

  it("rejects malformed ids and plain http outside localhost", () => {
    const problems = problemsOf({
      ...valid,
      AZURE_CLIENT_ID: "abc",
      APP_URL: "http://flows.example.com",
    });
    expect(problems).toEqual([
      expect.stringContaining("AZURE_CLIENT_ID has an invalid format"),
      expect.stringContaining("must use https://"),
    ]);
  });

  it("allows http for localhost", () => {
    expect(problemsOf({ ...valid, APP_URL: "http://localhost:3000" })).toEqual([]);
  });

  it("normalises lists and defaults preview managers to access managers", () => {
    const config = parseConfig({
      ...valid,
      ACCESS_MANAGERS: " Admin@Example.com; ops@example.com ,admin@example.com",
    });
    expect(config).toMatchObject({
      accessManagers: ["admin@example.com", "ops@example.com"],
      previewManagers: ["admin@example.com", "ops@example.com"],
    });
  });

  it("refuses grant access without managers", () => {
    expect(problemsOf({ ...valid, ENABLE_GRANT_ACCESS: "true" })).toEqual([
      expect.stringContaining("requires at least one ACCESS_MANAGERS"),
    ]);
  });

  it("never exposes allowlists to the browser", () => {
    const publicConfig = toPublicConfig(parseConfig({ ...valid, ACCESS_MANAGERS: "a@b.co" }));
    expect(Object.keys(publicConfig).sort()).toEqual(["appUrl", "clientId", "mode", "tenantId"]);
  });
});
