import { connection } from "next/server";
import { getDataSource } from "@/lib/server/data-source";
import { respond } from "@/lib/server/respond";

export async function GET() {
  await connection();
  return respond(async () => ({
    generatedAt: new Date().toISOString(),
    flows: await getDataSource().listFlows(),
  }));
}
