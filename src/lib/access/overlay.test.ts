import { describe, expect, it } from "vitest";
import type { Permission, Person } from "@/lib/domain/types";
import { withGrant, withoutPermission } from "./overlay";

const person = (id: string): Person => ({
  id,
  displayName: id,
  email: `${id}@contoso.com`,
  department: null,
  status: "active",
});
const base: Permission[] = [
  { id: "a", role: "Owner", principal: person("a") },
  { id: "b", role: "CanView", principal: person("b") },
];

describe("permission overlay", () => {
  it("adds a new co-owner", () => {
    const next = withGrant(base, { id: "c", role: "CanEdit", principal: person("c") });
    expect(next.map((permission) => permission.id)).toEqual(["a", "b", "c"]);
  });

  it("upgrades a run-only user instead of duplicating them", () => {
    const next = withGrant(base, { id: "b", role: "CanEdit", principal: person("b") });
    expect(next).toHaveLength(2);
    expect(next.find((permission) => permission.id === "b")?.role).toBe("CanEdit");
  });

  it("removes by permission id", () => {
    expect(withoutPermission(base, "b").map((permission) => permission.id)).toEqual(["a"]);
  });
});
