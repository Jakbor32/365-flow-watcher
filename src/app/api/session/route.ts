import { connection } from "next/server";
import { accessCapability } from "@/lib/access/rules";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

export async function GET(request: Request) {
  await connection();
  return respond(async () => {
    const { config, actor, canPreview } = await getContext(request);
    return {
      mode: config.mode,
      user: { name: actor.name, email: actor.email },
      access: accessCapability(config, actor.email),
      canPreview,
    };
  });
}
