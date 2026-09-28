import { connection } from "next/server";
import { accessCapability } from "@/lib/access/rules";
import { getConfig } from "@/lib/config";
import { respond } from "@/lib/server/respond";
import { getActor } from "@/lib/server/session";

export async function GET() {
  await connection();
  return respond(async () => {
    const config = getConfig();
    const actor = getActor();
    return { mode: config.mode, user: actor, access: accessCapability(config, actor.email) };
  });
}
