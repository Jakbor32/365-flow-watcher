import { connection } from "next/server";
import { getContext } from "@/lib/server/context";
import { respond } from "@/lib/server/respond";

export async function GET(request: Request) {
  await connection();
  return respond(async () => {
    const { source, previewing } = await getContext(request);
    return { generatedAt: new Date().toISOString(), previewing, flows: await source.listFlows() };
  });
}
