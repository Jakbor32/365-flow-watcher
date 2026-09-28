import { connection } from "next/server";
import { accessCapability, assertGrantable, parseEmail, parseGuid } from "@/lib/access/rules";
import { getConfig } from "@/lib/config";
import { BadRequestError, ForbiddenError } from "@/lib/data/source";
import { audit } from "@/lib/server/audit";
import { getDataSource } from "@/lib/server/data-source";
import { respond } from "@/lib/server/respond";
import { getActor } from "@/lib/server/session";

export async function GET(_request: Request, ctx: RouteContext<"/api/flows/[id]/permissions">) {
  await connection();
  return respond(async () => {
    const flowId = parseGuid((await ctx.params).id, "Flow ID");
    return { permissions: await getDataSource().listPermissions(flowId) };
  });
}

/** Grant access: add an active user as a co-owner (CanEdit). */
export async function POST(request: Request, ctx: RouteContext<"/api/flows/[id]/permissions">) {
  await connection();
  return respond(async () => {
    const actor = getActor();
    const capability = accessCapability(getConfig(), actor.email);
    if (!capability.canManage) throw new ForbiddenError(capability.reason ?? "Not allowed");

    const flowId = parseGuid((await ctx.params).id, "Flow ID");
    const body = await request.json().catch(() => {
      throw new BadRequestError("Body must be JSON");
    });
    const email = parseEmail(body?.email);

    const source = getDataSource();
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
