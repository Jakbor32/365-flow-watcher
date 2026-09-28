import { connection } from "next/server";
import { accessCapability } from "@/lib/access/rules";
import { getConfig } from "@/lib/config";
import { ForbiddenError } from "@/lib/data/source";
import { getDataSource } from "@/lib/server/data-source";
import { respond } from "@/lib/server/respond";
import { getActor } from "@/lib/server/session";

/** Directory lookup for the grant picker. Managers only, 2+ characters, 8 results. */
export async function GET(request: Request) {
  await connection();
  return respond(async () => {
    const actor = getActor();
    if (!accessCapability(getConfig(), actor.email).canManage) {
      throw new ForbiddenError("Not allowed");
    }
    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 64);
    return { people: query.length < 2 ? [] : await getDataSource().searchPeople(query, 8) };
  });
}
