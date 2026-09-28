import "server-only";
import { ConfigError } from "@/lib/config";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/data/source";
import { NotImplementedError } from "./data-source";

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
    if (error instanceof NotImplementedError) {
      return Response.json({ error: error.message }, { status: 501 });
    }
    console.error(error);
    return Response.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
