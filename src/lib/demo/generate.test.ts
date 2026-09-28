import { describe, expect, it } from "vitest";
import { DemoDataSource } from "@/lib/data/demo-source";
import { isOrphaned } from "@/lib/domain/orphans";
import { generateDemoTenant } from "./generate";

const now = new Date("2026-09-28T10:00:00Z");

describe("generateDemoTenant", () => {
  const tenant = generateDemoTenant({ now });

  it("is deterministic for the same seed and date", () => {
    const again = generateDemoTenant({ now });
    expect(again.flows).toEqual(tenant.flows);
    expect([...again.runsByFlow.values()]).toEqual([...tenant.runsByFlow.values()]);
  });

  it("changes with the seed", () => {
    const other = generateDemoTenant({ now, seed: 7 });
    expect(other.flows[0].id).not.toBe(tenant.flows[0].id);
  });

  it("creates 100 flows with unique ids and names", () => {
    expect(tenant.flows).toHaveLength(100);
    expect(new Set(tenant.flows.map((flow) => flow.id)).size).toBe(100);
    expect(new Set(tenant.flows.map((flow) => flow.displayName)).size).toBe(100);
  });

  it("never produces runs in the future or older than 30 days", () => {
    const oldest = now.getTime() - 30 * 24 * 3_600_000;
    for (const runs of tenant.runsByFlow.values()) {
      for (const run of runs) {
        const start = Date.parse(run.startTime);
        expect(start).toBeLessThanOrEqual(now.getTime());
        expect(start).toBeGreaterThan(oldest);
      }
    }
  });

  it("keeps runs sorted newest first", () => {
    for (const runs of tenant.runsByFlow.values()) {
      const starts = runs.map((run) => Date.parse(run.startTime));
      expect(starts).toEqual([...starts].sort((a, b) => b - a));
    }
  });

  it("only attaches errors to failed runs", () => {
    for (const runs of tenant.runsByFlow.values()) {
      for (const run of runs) {
        expect(run.error !== null).toBe(run.status === "Failed");
      }
    }
  });

  it("has a realistic mix of states, failures and orphans", () => {
    const states = tenant.flows.map((flow) => flow.state);
    expect(states.filter((state) => state === "enabled").length).toBeGreaterThan(70);
    expect(states).toContain("disabled");
    expect(states).toContain("suspended");

    const orphaned = tenant.flows.filter((flow) =>
      isOrphaned(flow, tenant.permissionsByFlow.get(flow.id) ?? []),
    );
    expect(orphaned.length).toBeGreaterThanOrEqual(3);
    expect(orphaned.length).toBeLessThanOrEqual(15);

    const failed = [...tenant.runsByFlow.values()].flat().filter((run) => run.status === "Failed");
    expect(failed.length).toBeGreaterThan(50);
  });

  it("uses only fictional contoso.com accounts", () => {
    for (const person of tenant.people) {
      expect(person.email).toMatch(/@contoso\.com$/);
    }
  });
});

describe("DemoDataSource", () => {
  const source = new DemoDataSource(now);

  it("simulates grant access without persisting it", async () => {
    const [flow] = await source.listFlows();
    const before = await source.listPermissions(flow.id);
    const outsider = generateDemoTenant({ now }).people.find(
      (person) =>
        person.status === "active" && !before.some((permission) => permission.id === person.id),
    )!;

    const result = await source.grantAccess(flow.id, outsider.email);

    expect(result.simulated).toBe(true);
    expect(result.permission.role).toBe("CanEdit");
    expect(await source.listPermissions(flow.id)).toEqual(before);
  });

  it("refuses to grant access to a disabled account", async () => {
    const [flow] = await source.listFlows();
    const disabled = generateDemoTenant({ now }).people.find(
      (person) => person.status === "disabled",
    )!;
    await expect(source.grantAccess(flow.id, disabled.email)).rejects.toThrow(/No active user/);
  });

  it("rejects unknown flows", async () => {
    await expect(source.listRuns("missing", 10)).rejects.toThrow(/not found/);
  });
});
