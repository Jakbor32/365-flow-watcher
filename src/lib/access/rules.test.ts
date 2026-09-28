import { describe, expect, it } from "vitest";
import { parseConfig } from "@/lib/config";
import { DemoDataSource } from "@/lib/data/demo-source";
import { accessCapability, assertGrantable, assertRevocable, parseEmail, parseGuid } from "./rules";

const live = parseConfig({
  AZURE_TENANT_ID: "11111111-1111-4111-8111-111111111111",
  AZURE_CLIENT_ID: "22222222-2222-4222-8222-222222222222",
  POWER_PLATFORM_ENVIRONMENT_ID: "11111111-1111-4111-8111-111111111111",
  APP_URL: "http://localhost:3000",
  ACCESS_MANAGERS: "boss@contoso.com",
  ENABLE_GRANT_ACCESS: "true",
});

describe("accessCapability", () => {
  it("simulates everything in demo mode", () => {
    expect(accessCapability({ mode: "demo" }, "anyone@x.com")).toMatchObject({
      canManage: true,
      simulated: true,
    });
  });

  it("allows only listed managers, case-insensitively", () => {
    expect(accessCapability(live, "Boss@Contoso.com").canManage).toBe(true);
    expect(accessCapability(live, "intern@contoso.com")).toMatchObject({
      canManage: false,
      reason: expect.stringContaining("ACCESS_MANAGERS"),
    });
  });

  it("denies everyone when the feature flag is off", () => {
    const off = { ...live, enableGrantAccess: false };
    expect(accessCapability(off, "boss@contoso.com").canManage).toBe(false);
  });
});

describe("input parsing", () => {
  it("normalises emails and rejects junk", () => {
    expect(parseEmail("  Adele.Vance@Contoso.com ")).toBe("adele.vance@contoso.com");
    for (const bad of ["", "nope", "a@b", 42, null, `${"a".repeat(250)}@x.com`]) {
      expect(() => parseEmail(bad)).toThrow(/valid email/);
    }
  });

  it("only accepts GUIDs as ids", () => {
    expect(() => parseGuid("../../etc/passwd", "flowId")).toThrow(/GUID/);
    expect(parseGuid("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", "flowId")).toMatch(/^a{8}-/);
  });
});

describe("grant/revoke rules", async () => {
  const source = new DemoDataSource(new Date("2026-09-28T10:00:00Z"));
  const flows = await source.listFlows();
  const flow = flows.find((candidate) => candidate.owner.status === "active")!;
  const permissions = await source.listPermissions(flow.id);

  it("refuses duplicates and inactive accounts", async () => {
    expect(() => assertGrantable(permissions, flow.owner, flow.owner.email)).toThrow(
      /already has access/,
    );
    const disabled = (await source.listFlows()).find((f) => f.owner.status === "disabled")!.owner;
    expect(() => assertGrantable(permissions, disabled, disabled.email)).toThrow(/disabled/);
    expect(() => assertGrantable(permissions, null, "ghost@contoso.com")).toThrow(/No user/);
  });

  it("upgrades run-only users to co-owner", async () => {
    const flows = await source.listFlows();
    for (const candidate of flows) {
      const perms = await source.listPermissions(candidate.id);
      const viewer = perms.find((permission) => permission.role === "CanView");
      if (viewer?.principal.status === "active") {
        expect(() =>
          assertGrantable(perms, viewer.principal, viewer.principal.email),
        ).not.toThrow();
        return;
      }
    }
    throw new Error("demo tenant has no active run-only user");
  });

  it("never removes the primary owner", () => {
    expect(() => assertRevocable(flow, permissions, flow.owner.id)).toThrow(/primary owner/);
    expect(() => assertRevocable(flow, permissions, "missing")).toThrow(/no access/);
  });
});
