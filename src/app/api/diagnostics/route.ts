import { connection } from "next/server";
import { getConfig } from "@/lib/config";
import { runDiagnostics } from "@/lib/live/diagnostics";
import { respond } from "@/lib/server/respond";

/**
 * Setup checks. Deliberately skips the normal access gate (DASHBOARD_USERS,
 * admin role): the point is to explain why that gate says no. Reads only.
 */
export async function GET(request: Request) {
  await connection();
  return respond(async () => ({
    checks: await runDiagnostics(getConfig(), {
      flow: request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? null,
      graph: request.headers.get("x-graph-token"),
    }),
  }));
}
