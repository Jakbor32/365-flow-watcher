import { describe, expect, it } from "vitest";
import { checkTokenPair, readClaims } from "./tokens";

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const later = Math.floor(Date.now() / 1000) + 3600;

function jwt(claims: Record<string, unknown>) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none" })}.${part(claims)}.sig`;
}

const flow = {
  aud: "https://service.flow.microsoft.com/",
  tid: TENANT,
  oid: USER,
  exp: later,
  scp: "User Flows.Read.All",
};
const graph = { aud: "00000003-0000-0000-c000-000000000000", tid: TENANT, oid: USER, exp: later };
const check = (f: Record<string, unknown>, g: Record<string, unknown>) =>
  checkTokenPair(readClaims(jwt(f)), readClaims(jwt(g)), TENANT);

describe("token pair checks", () => {
  it("accepts a matching pair and reads scopes", () => {
    expect(check(flow, graph)).toBeNull();
    expect(readClaims(jwt(flow))?.scopes).toEqual(["User", "Flows.Read.All"]);
  });

  it("rejects another tenant, wrong audience, mixed users and expiry", () => {
    expect(check({ ...flow, tid: "22222222-2222-4222-8222-222222222222" }, graph)).toMatch(
      /another tenant/,
    );
    expect(check({ ...flow, aud: "https://graph.microsoft.com" }, graph)).toMatch(/wrong audience/);
    expect(check(flow, { ...graph, oid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })).toMatch(
      /different users/,
    );
    expect(check({ ...flow, exp: 1 }, graph)).toMatch(/expired/);
  });

  it("rejects garbage", () => {
    expect(checkTokenPair(readClaims("not-a-jwt"), null, TENANT)).toMatch(/not valid/);
  });
});
