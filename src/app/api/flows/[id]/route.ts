import { connection } from "next/server";
import { parseGuid } from "@/lib/access/rules";
import { NotFoundError } from "@/lib/data/source";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

export async function GET(request: Request, ctx: RouteContext<"/api/flows/[id]">) {
  await connection();
  return respond(async () => {
    const flowId = parseGuid((await ctx.params).id, "Flow ID");
    const { source } = await getContext(request);
    const flow = await source.getFlow(flowId);
    if (!flow) throw new NotFoundError("Flow not found");
    return { flow, generatedAt: new Date().toISOString() };
  });
}
