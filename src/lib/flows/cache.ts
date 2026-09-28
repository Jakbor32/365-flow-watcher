import type { FlowWithHealth } from "@/lib/domain/types";

// Loaded flows live in memory for this tab until a full reload (F5) or the
// Refresh button. Filters and back-navigation never refetch: on a real tenant
// one load can take a while.

interface Entry {
  flows: FlowWithHealth[];
  generatedAt: number;
}

const loaded = new Map<string, Entry>();

/** Key per preview account; "" is the normal view. */
export const cacheKey = (previewAs: string | null) => previewAs ?? "";

export const cachedFlows = (key: string) => loaded.get(key) ?? null;

export function storeFlows(key: string, entry: Entry) {
  loaded.set(key, entry);
}

export function forgetFlows() {
  loaded.clear();
}
