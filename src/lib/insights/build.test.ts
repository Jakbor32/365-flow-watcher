import { describe, expect, it } from "vitest";
import { DemoDataSource } from "@/lib/data/demo-source";
import { buildInsights } from "./build";

const now = new Date("2026-09-28T10:00:00Z");
const source = new DemoDataSource(now);
const flows = await source.listFlows();
const failing = flows.filter((flow) => flow.recentFailures > 0);
const runsByFlow = new Map(
  await Promise.all(
    failing.map(async (flow) => [flow.id, await source.listRuns(flow.id, 800)] as const),
  ),
);
const insights = buildInsights(flows, runsByFlow, now);

describe("buildInsights", () => {
  it("sums runs per day across all flows", () => {
    expect(insights.daily).toHaveLength(14);
    const totalFailed = insights.daily.reduce((sum, day) => sum + day.failed, 0);
    const perFlow = flows.reduce(
      (sum, flow) => sum + flow.daily.reduce((s, d) => s + d.failed, 0),
      0,
    );
    expect(totalFailed).toBe(perFlow);
  });

  it("ranks the most failing flows", () => {
    const failures = insights.topFailing.map((flow) => flow.failures);
    expect(failures).toEqual([...failures].sort((a, b) => b - a));
    expect(insights.topFailing[0].failures).toBe(
      Math.max(...flows.map((flow) => flow.recentFailures)),
    );
  });

  it("groups errors by code and action, counting affected flows", () => {
    const [top] = insights.commonErrors;
    expect(top.count).toBeGreaterThan(0);
    expect(top.flows).toBeGreaterThan(0);
    expect(top.flows).toBeLessThanOrEqual(top.count);
    const counts = insights.commonErrors.map((error) => error.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("lists only inactive owners, orphans first", () => {
    expect(insights.ownershipRisk.length).toBeGreaterThan(0);
    expect(insights.ownershipRisk.every((entry) => entry.owner.status !== "active")).toBe(true);
    const orphaned = insights.ownershipRisk.reduce((sum, entry) => sum + entry.orphaned, 0);
    expect(orphaned).toBe(flows.filter((flow) => flow.orphaned).length);
  });

  it("counts flows per connector", () => {
    const sharepoint = insights.connectors.find((connector) => connector.name === "SharePoint")!;
    expect(sharepoint.flows).toBe(
      flows.filter((flow) => flow.connectors.includes("SharePoint")).length,
    );
    expect(sharepoint.failing).toBeLessThanOrEqual(sharepoint.flows);
  });
});
