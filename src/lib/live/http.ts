import "server-only";

export const FLOW_API = "https://api.flow.microsoft.com";
export const FLOW_API_VERSION = "2016-11-01";
export const GRAPH_API = "https://graph.microsoft.com/v1.0";

/** A Microsoft API said no. `status` is theirs; the route maps it. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly service: "Flow Service" | "Microsoft Graph",
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  service: UpstreamError["service"];
  timeoutMs?: number;
}

/** JSON request with a bearer token. 204 → null. Never logs the token. */
export async function requestJson(
  url: string,
  token: string,
  options: RequestOptions,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    // Keep the low-level cause (ECONNRESET, ENOTFOUND, ...) so failures are diagnosable.
    const cause = (error as { cause?: { code?: string } })?.cause?.code;
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? "timed out"
        : `is unreachable${cause ? ` (${cause})` : ""}`;
    throw new UpstreamError(`${options.service} ${reason}`, 504, options.service);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  const payload = parse(text);
  if (!response.ok) {
    throw new UpstreamError(
      upstreamMessage(payload, response.status, options.service),
      response.status,
      options.service,
    );
  }
  return payload;
}

/** Follows `nextLink` / `@odata.nextLink` up to `maxPages`. */
export async function requestPaged(
  firstUrl: string,
  token: string,
  service: UpstreamError["service"],
  maxPages: number,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let url: string | null = firstUrl;
  for (let page = 0; url && page < maxPages; page++) {
    const payload = await requestJson(url, token, { service });
    items.push(...arrayOf(payload));
    url = nextLink(payload, url);
  }
  return items;
}

export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function arrayOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  return Array.isArray(record?.value) ? (record.value as unknown[]) : [];
}

function nextLink(payload: unknown, current: string): string | null {
  const record = asRecord(payload);
  const link = record?.nextLink ?? record?.["@odata.nextLink"];
  if (typeof link !== "string") return null;
  const resolved = new URL(link, current);
  // Only ever follow links back to the same Microsoft API host.
  return resolved.origin === new URL(current).origin ? resolved.toString() : null;
}

function upstreamMessage(payload: unknown, status: number, service: string): string {
  const error = asRecord(asRecord(payload)?.error);
  const code = typeof error?.code === "string" ? error.code : null;
  const message = typeof error?.message === "string" ? error.message : null;
  const detail = [code, message].filter(Boolean).join(": ");
  return `${service} returned ${status}${detail ? ` (${detail.slice(0, 300)})` : ""}`;
}

function parse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
