import { describe, expect, it } from "vitest";
import { DemoDataSource } from "@/lib/data/demo-source";
import { percent, timeAgo } from "@/lib/format";
import { escapeCell, toCsv } from "./csv";
import {
  DEFAULT_QUERY,
  activeFilterCount,
  filterFlows,
  parseQuery,
  serializeQuery,
  summarize,
} from "./filter";

const now = new Date("2026-09-28T10:00:00Z");
const flows = await new DemoDataSource(now).listFlows();

describe("filterFlows", () => {
  it("returns everything with the default query, worst flows first", () => {
    const result = filterFlows(flows, DEFAULT_QUERY);
    expect(result).toHaveLength(flows.length);
    const failures = result.map((flow) => flow.recentFailures);
    expect(failures).toEqual([...failures].sort((a, b) => b - a));
  });

  it("combines filters", () => {
    const result = filterFlows(flows, { ...DEFAULT_QUERY, state: "enabled", health: "failing" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((flow) => flow.state === "enabled" && flow.recentFailures > 0)).toBe(true);
  });

  it("finds orphaned flows", () => {
    const result = filterFlows(flows, { ...DEFAULT_QUERY, orphanedOnly: true });
    expect(result.length).toBe(summarize(flows).orphaned);
    expect(result.every((flow) => flow.owner.status !== "active")).toBe(true);
  });

  it("searches name, owner and id case-insensitively", () => {
    const target = flows[10];
    for (const needle of [target.displayName.toUpperCase(), target.owner.email, target.id]) {
      expect(filterFlows(flows, { ...DEFAULT_QUERY, search: needle })).toContainEqual(target);
    }
  });

  it("splits flows into failing, healthy and idle without overlap", () => {
    const count = (health: "failing" | "healthy" | "idle") =>
      filterFlows(flows, { ...DEFAULT_QUERY, health }).length;
    expect(count("failing") + count("healthy") + count("idle")).toBe(flows.length);
  });
});

describe("query <-> URL", () => {
  it("round-trips a query", () => {
    const query = {
      ...DEFAULT_QUERY,
      search: "invoice",
      state: "enabled" as const,
      orphanedOnly: true,
      sort: "name" as const,
      descending: false,
    };
    expect(parseQuery(serializeQuery(query))).toEqual(query);
  });

  it("keeps default URLs empty and ignores junk", () => {
    expect(serializeQuery(DEFAULT_QUERY).toString()).toBe("");
    expect(parseQuery(new URLSearchParams("state=deleted&sort=drop"))).toEqual(DEFAULT_QUERY);
  });

  it("counts active filters, not search or sort", () => {
    expect(activeFilterCount({ ...DEFAULT_QUERY, search: "x", sort: "name" })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_QUERY, state: "disabled", orphanedOnly: true })).toBe(2);
  });
});

describe("CSV export", () => {
  it("neutralises formula injection", () => {
    expect(escapeCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(escapeCell("+1")).toBe("'+1");
    expect(escapeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCell("Finance - Invoice approval")).toBe("Finance - Invoice approval");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(escapeCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it("writes a header plus one row per flow", () => {
    const lines = toCsv(flows.slice(0, 3)).trimEnd().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^Flow ID,Name,State,Owner/);
    expect(lines[1]).toContain(flows[0].id);
  });
});

describe("format", () => {
  const base = Date.parse("2026-09-28T10:00:00Z");
  it("formats relative time", () => {
    expect(timeAgo("2026-09-28T07:00:00Z", base)).toBe("3h ago");
    expect(timeAgo("2026-09-27T09:00:00Z", base)).toBe("yesterday");
    expect(timeAgo("2026-09-28T09:59:30Z", base)).toBe("just now");
  });

  it("formats percentages", () => {
    expect(percent(0, 0)).toBe("0%");
    expect(percent(1, 200)).toBe("0.5%");
    expect(percent(33, 38)).toBe("87%");
  });
});
