import { connection } from "next/server";
import { parseGuid } from "@/lib/access/rules";
import { NotFoundError } from "@/lib/data/source";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

const MAX_RUNS = 100;

export async function GET(request: Request, ctx: RouteContext<"/api/flows/[id]/runs">) {
  await connection();
  return respond(async () => {
    const flowId = parseGuid((await ctx.params).id, "Flow ID");
    const requested = Number(new URL(request.url).searchParams.get("limit") ?? 10);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 1), MAX_RUNS)
      : 10;
    const { source } = await getContext(request);
    // Scope check: only flows visible in this view have readable runs.
    if (!(await source.getFlow(flowId))) throw new NotFoundError("Flow not found");
    return { runs: await source.listRuns(flowId, limit), limit };
  });
}
