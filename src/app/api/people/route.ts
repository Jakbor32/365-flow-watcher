import { connection } from "next/server";
import { accessCapability } from "@/lib/access/rules";
import { ForbiddenError } from "@/lib/data/source";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

/** Directory lookup for the grant picker. Managers only, 2+ characters, 8 results. */
export async function GET(request: Request) {
  await connection();
  return respond(async () => {
    const { config, actor, source } = await getContext(request);
    if (!accessCapability(config, actor.email).canManage) throw new ForbiddenError("Not allowed");
    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 64);
    return { people: query.length < 2 ? [] : await source.searchPeople(query, 8) };
  });
}
