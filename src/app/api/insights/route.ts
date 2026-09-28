import { connection } from "next/server";
import { buildInsights } from "@/lib/insights/build";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

// Errors only come from flows that failed recently, so only their run history
// is read. In live mode that keeps this to a handful of API calls.
const RUNS_PER_FAILING_FLOW = 200;

export async function GET(request: Request) {
  await connection();
  return respond(async () => {
    const { source } = await getContext(request);
    const flows = await source.listFlows();
    const failing = flows.filter((flow) => flow.recentFailures > 0);
    const runs = await Promise.all(
      failing.map(
        async (flow) => [flow.id, await source.listRuns(flow.id, RUNS_PER_FAILING_FLOW)] as const,
      ),
    );
    const now = new Date();
    return { insights: buildInsights(flows, new Map(runs), now), generatedAt: now.toISOString() };
  });
}
