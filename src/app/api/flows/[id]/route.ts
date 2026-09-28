import { connection } from "next/server";
import { parseGuid } from "@/lib/access/rules";
import { NotFoundError } from "@/lib/data/source";
import { getDataSource } from "@/lib/server/data-source";
import { respond } from "@/lib/server/respond";

export async function GET(_request: Request, ctx: RouteContext<"/api/flows/[id]">) {
  await connection();
  return respond(async () => {
    const flowId = parseGuid((await ctx.params).id, "Flow ID");
    const flow = await getDataSource().getFlow(flowId);
    if (!flow) throw new NotFoundError("Flow not found");
    return { flow, generatedAt: new Date().toISOString() };
  });
}
