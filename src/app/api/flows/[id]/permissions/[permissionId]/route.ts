import { connection } from "next/server";
import { accessCapability, assertRevocable, parseGuid } from "@/lib/access/rules";
import { ForbiddenError, NotFoundError } from "@/lib/data/source";
import { audit } from "@/lib/server/audit";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

/** Revoke access: remove a co-owner. The primary owner is never removable. */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/flows/[id]/permissions/[permissionId]">,
) {
  await connection();
  return respond(async () => {
    const { config, actor, source } = await getContext(request);
    const capability = accessCapability(config, actor.email);
    if (!capability.canManage) throw new ForbiddenError(capability.reason ?? "Not allowed");

    const params = await ctx.params;
    const flowId = parseGuid(params.id, "Flow ID");
    const permissionId = parseGuid(params.permissionId, "Permission ID");

    const flow = await source.getFlow(flowId);
    if (!flow) throw new NotFoundError("Flow not found");
    const permission = assertRevocable(flow, await source.listPermissions(flowId), permissionId);

    const result = await source.revokeAccess(flowId, permissionId);
    audit({
      action: "access.revoke",
      actor: actor.email,
      flowId,
      target: permission.principal.email,
      role: permission.role,
      simulated: result.simulated,
    });
    return result;
  });
}
