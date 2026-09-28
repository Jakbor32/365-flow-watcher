import "server-only";
import type { Person } from "@/lib/domain/types";
import {
  GRAPH_API,
  UpstreamError,
  arrayOf,
  asRecord,
  mapConcurrent,
  requestJson,
  str,
} from "./http";
import { guid } from "./normalize";

const BASIC = "id,displayName,mail,userPrincipalName,department";
// accountEnabled needs User.Read.All; without it Graph answers 403 and the
// owner can only be classified as active or deleted.
const WITH_STATUS = `${BASIC},accountEnabled`;

export interface Me {
  id: string;
  displayName: string;
  upn: string;
  mail: string | null;
}

export async function getMe(token: string): Promise<Me> {
  const raw = asRecord(
    await requestJson(`${GRAPH_API}/me?$select=${BASIC}`, token, { service: "Microsoft Graph" }),
  );
  const id = guid(raw?.id);
  const upn = str(raw?.userPrincipalName)?.toLowerCase();
  if (!id || !upn)
    throw new UpstreamError(
      "Microsoft Graph returned no user for this token",
      401,
      "Microsoft Graph",
    );
  return {
    id,
    upn,
    displayName: str(raw?.displayName) ?? upn,
    mail: str(raw?.mail)?.toLowerCase() ?? null,
  };
}

export function toPerson(raw: unknown, fallbackId?: string): Person | null {
  const record = asRecord(raw);
  const id = guid(record?.id) ?? fallbackId ?? null;
  if (!record || !id) return null;
  const email = (str(record.mail) ?? str(record.userPrincipalName) ?? "").toLowerCase();
  return {
    id,
    displayName: str(record.displayName) ?? (email || id),
    email,
    department: str(record.department),
    status: record.accountEnabled === false ? "disabled" : "active",
  };
}

export function deletedPerson(id: string): Person {
  return { id, displayName: "Deleted user", email: "", department: null, status: "deleted" };
}

/**
 * Resolves object IDs to people in $batch calls of 20. Missing (404) users
 * come back as deleted; that is exactly the orphan signal we need.
 */
export async function getPeople(
  token: string,
  ids: string[],
): Promise<{ people: Map<string, Person>; statusKnown: boolean }> {
  const unique = [...new Set(ids)];
  const chunks = Array.from({ length: Math.ceil(unique.length / 20) }, (_, i) =>
    unique.slice(i * 20, i * 20 + 20),
  );
  const people = new Map<string, Person>();
  let statusKnown = true;

  await mapConcurrent(chunks, 4, async (chunk) => {
    let responses = await batchUsers(token, chunk, WITH_STATUS);
    const forbidden = responses
      .filter((response) => response.status === 403)
      .map((response) => response.id);
    if (forbidden.length > 0) {
      statusKnown = false;
      responses = [
        ...responses.filter((response) => response.status !== 403),
        ...(await batchUsers(token, forbidden, BASIC)),
      ];
    }
    for (const response of responses) {
      if (response.status === 404) people.set(response.id, deletedPerson(response.id));
      else if (response.status < 300) {
        const person = toPerson(response.body, response.id);
        if (person) people.set(response.id, person);
      }
    }
  });

  return { people, statusKnown };
}

async function batchUsers(token: string, ids: string[], select: string) {
  const payload = asRecord(
    await requestJson(`${GRAPH_API}/$batch`, token, {
      method: "POST",
      service: "Microsoft Graph",
      body: {
        requests: ids.map((id, index) => ({
          id: String(index),
          method: "GET",
          url: `/users/${id}?$select=${select}`,
        })),
      },
    }),
  );
  return arrayOf(payload?.responses).map((raw) => {
    const response = asRecord(raw);
    return {
      id: ids[Number(response?.id)],
      status: Number(response?.status),
      body: response?.body,
    };
  });
}

export async function findPersonByEmail(token: string, email: string): Promise<Person | null> {
  const lookup = (select: string) =>
    requestJson(`${GRAPH_API}/users/${encodeURIComponent(email)}?$select=${select}`, token, {
      service: "Microsoft Graph",
    });
  try {
    // With status first, so a disabled account is never treated as active.
    return toPerson(await withStatusFallback(lookup));
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) return null;
    throw error;
  }
}

export async function searchPeople(token: string, query: string, limit: number): Promise<Person[]> {
  // $search terms are quoted; strip anything that could break out of the quotes.
  const term = query.replace(/["\\]/g, "").trim();
  if (term.length < 2) return [];
  const search = (select: string) => {
    const url = new URL(`${GRAPH_API}/users`);
    url.searchParams.set("$search", `"displayName:${term}" OR "mail:${term}"`);
    url.searchParams.set("$select", select);
    url.searchParams.set("$top", String(limit));
    return requestJson(url.toString(), token, {
      service: "Microsoft Graph",
      headers: { ConsistencyLevel: "eventual" },
    });
  };
  return arrayOf(await withStatusFallback(search))
    .map((raw) => toPerson(raw))
    .filter((person): person is Person => person !== null && person.status === "active");
}

/** Tries with accountEnabled; without User.Read.All Graph says 403, so retry without. */
async function withStatusFallback(request: (select: string) => Promise<unknown>): Promise<unknown> {
  try {
    return await request(WITH_STATUS);
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 403) return request(BASIC);
    throw error;
  }
}
