import "server-only";
import { getConfig } from "@/lib/config";
import { DemoDataSource, demoNow } from "@/lib/data/demo-source";
import type { DataSource } from "@/lib/data/source";

export class NotImplementedError extends Error {}

let demo: { hour: number; source: DemoDataSource } | null = null;

/** Picks the data source for this request. Live mode arrives in module 5. */
export function getDataSource(): DataSource {
  const config = getConfig();

  if (config.mode === "demo") {
    const now = demoNow();
    // Regenerate once an hour so relative dates stay fresh.
    if (demo?.hour !== now.getTime()) {
      demo = { hour: now.getTime(), source: new DemoDataSource(now) };
    }
    return demo.source;
  }

  throw new NotImplementedError("Live mode is not implemented yet");
}
