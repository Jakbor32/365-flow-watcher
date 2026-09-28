// Claims are read without verifying the signature: Microsoft verifies every
// token when we call its APIs. These checks only reject obviously wrong
// tokens early and bind the two tokens to one user and one tenant.

export const FLOW_AUDIENCES = [
  "https://service.flow.microsoft.com",
  "https://service.flow.microsoft.com/",
];
export const GRAPH_AUDIENCES = [
  "00000003-0000-0000-c000-000000000000",
  "https://graph.microsoft.com",
];

export interface TokenClaims {
  aud: string | null;
  tid: string | null;
  oid: string | null;
  scopes: string[];
  expiresAt: number | null;
}

export function readClaims(token: string): TokenClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    const text = (key: string) =>
      typeof claims[key] === "string" ? (claims[key] as string) : null;
    return {
      aud: text("aud"),
      tid: text("tid")?.toLowerCase() ?? null,
      oid: text("oid")?.toLowerCase() ?? null,
      scopes: (text("scp") ?? "").split(" ").filter(Boolean),
      expiresAt: typeof claims.exp === "number" ? claims.exp * 1000 : null,
    };
  } catch {
    return null;
  }
}

/** Returns a problem description, or null when the token pair is usable. */
export function checkTokenPair(
  flow: TokenClaims | null,
  graph: TokenClaims | null,
  tenantId: string,
  now = Date.now(),
): string | null {
  if (!flow || !graph) return "Tokens are not valid JWTs";
  if (!FLOW_AUDIENCES.includes(flow.aud ?? "")) return "Flow token has the wrong audience";
  if (!GRAPH_AUDIENCES.includes(graph.aud ?? "")) return "Graph token has the wrong audience";
  if (flow.tid !== tenantId.toLowerCase() || graph.tid !== tenantId.toLowerCase()) {
    return "Token was issued for another tenant";
  }
  if (!flow.oid || flow.oid !== graph.oid) return "Tokens belong to different users";
  if ((flow.expiresAt ?? 0) < now || (graph.expiresAt ?? 0) < now) return "Token expired";
  return null;
}
