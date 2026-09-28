import { connection } from "next/server";
import { buildInsights } from "@/lib/insights/build";
import { mapConcurrent } from "@/lib/live/http";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

// Errors only come from flows that failed recently, so only their run history
// is read. Live mode serves it from the inventory load (latest 100 runs).
const RUNS_PER_FAILING_FLOW = 100;

export async function GET(request: Request) {
  await connection();
  return respond(async () => {
    const { source } = await getContext(request);
    const flows = await source.listFlows();
    const failing = flows.filter((flow) => flow.recentFailures > 0);
    // Bounded: dozens of parallel calls get connections dropped by Microsoft.
    const runs = await mapConcurrent(
      failing,
      8,
      async (flow) => [flow.id, await source.listRuns(flow.id, RUNS_PER_FAILING_FLOW)] as const,
    );
    const now = new Date();
    return { insights: buildInsights(flows, new Map(runs), now), generatedAt: now.toISOString() };
  });
}
