import { connection } from "next/server";
import { ConfigError, getConfig } from "@/lib/config";

/** Liveness + config check, used by the Docker HEALTHCHECK. */
export async function GET() {
  await connection();

  try {
    const { mode } = getConfig();
    return Response.json({ status: "ok", mode });
  } catch (error) {
    if (error instanceof ConfigError) {
      // Only variable names and format hints, never values.
      return Response.json({ status: "misconfigured", problems: error.problems }, { status: 500 });
    }
    throw error;
  }
}
