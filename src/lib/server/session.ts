import "server-only";
import { getConfig } from "@/lib/config";
import { NotImplementedError } from "./data-source";

export interface Actor {
  name: string;
  email: string;
}

export const DEMO_ACTOR: Actor = { name: "Demo Admin", email: "demo.admin@contoso.com" };

/** Who is making this request. Live mode validates the MSAL token (module 5). */
export function getActor(): Actor {
  if (getConfig().mode === "demo") return DEMO_ACTOR;
  throw new NotImplementedError("Live mode is not implemented yet");
}
