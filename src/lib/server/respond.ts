import "server-only";
import { ConfigError } from "@/lib/config";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/data/source";
import { UpstreamError } from "@/lib/live/http";

/** Maps known errors to JSON responses; anything else is logged and hidden. */
export async function respond<T>(work: () => Promise<T>, status = 200): Promise<Response> {
  try {
    return Response.json(await work(), { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConfigError) {
      return Response.json(
        { error: "Server is misconfigured", problems: error.problems },
        { status: 500 },
      );
    }
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof UpstreamError) {
      // Pass through what the user can act on; everything else is a bad gateway.
      const status = [401, 403, 404, 429].includes(error.status) ? error.status : 502;
      return Response.json({ error: error.message, service: error.service }, { status });
    }
    console.error(error);
    return Response.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
