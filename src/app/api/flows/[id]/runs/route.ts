import { connection } from "next/server";
import { parseGuid } from "@/lib/access/rules";
import { getDataSource } from "@/lib/server/data-source";
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
    return { runs: await getDataSource().listRuns(flowId, limit), limit };
  });
}
