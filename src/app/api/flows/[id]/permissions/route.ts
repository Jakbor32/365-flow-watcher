import { connection } from "next/server";
import { accessCapability, assertGrantable, parseEmail, parseGuid } from "@/lib/access/rules";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/data/source";
import { audit } from "@/lib/server/audit";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

export async function GET(request: Request, ctx: RouteContext<"/api/flows/[id]/permissions">) {
  await connection();
  return respond(async () => {
    const flowId = parseGuid((await ctx.params).id, "Flow ID");
    const { source } = await getContext(request);
    if (!(await source.getFlow(flowId))) throw new NotFoundError("Flow not found");
    return { permissions: await source.listPermissions(flowId) };
  });
}

/** Grant access: add an active user as a co-owner (CanEdit). */
export async function POST(request: Request, ctx: RouteContext<"/api/flows/[id]/permissions">) {
  await connection();
  return respond(async () => {
    const { config, actor, source } = await getContext(request);
    const capability = accessCapability(config, actor.email);
    if (!capability.canManage) throw new ForbiddenError(capability.reason ?? "Not allowed");

    const flowId = parseGuid((await ctx.params).id, "Flow ID");
    const body = await request.json().catch(() => {
      throw new BadRequestError("Body must be JSON");
    });
    const email = parseEmail(body?.email);

    if (!(await source.getFlow(flowId))) throw new NotFoundError("Flow not found");
    const [permissions, person] = await Promise.all([
      source.listPermissions(flowId),
      source.findPerson(email),
    ]);
    assertGrantable(permissions, person, email);

    const result = await source.grantAccess(flowId, email);
    audit({
      action: "access.grant",
      actor: actor.email,
      flowId,
      target: email,
      role: result.permission.role,
      simulated: result.simulated,
    });
    return result;
  }, 201);
}
