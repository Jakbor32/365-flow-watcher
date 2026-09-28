// Every browser → API call goes through here. In live mode it attaches the
// signed-in user's Flow Service token (Authorization) and Graph token.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type TokenSource = () => Promise<{ flow: string; graph: string } | null>;
let tokenSource: TokenSource | null = null;

/** Set by AuthProvider in live mode; demo mode sends no tokens. */
export function setTokenSource(source: TokenSource | null) {
  tokenSource = source;
}

/** `?as=` (preview another account) travels with every API call on the page. */
function withPreview(path: string): string {
  const as =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("as");
  if (!as) return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set("as", as);
  return url.pathname + url.search;
}

export async function api<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (tokenSource) {
    const tokens = await tokenSource();
    if (!tokens) throw new ApiError("Signing in…", 401);
    headers.Authorization = `Bearer ${tokens.flow}`;
    headers["X-Graph-Token"] = tokens.graph;
  }

  const response = await fetch(withPreview(path), {
    method: init.method ?? "GET",
    signal: init.signal,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status);
  }
  return body as T;
}

export interface Session {
  mode: "demo" | "live";
  user: { name: string; email: string };
  access: { canManage: boolean; simulated: boolean; reason: string | null };
  canPreview: boolean;
}
