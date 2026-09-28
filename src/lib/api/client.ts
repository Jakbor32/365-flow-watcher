// Every browser → API call goes through here. Module 5 adds the MSAL
// bearer token in this one place.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    signal: init.signal,
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
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
}
