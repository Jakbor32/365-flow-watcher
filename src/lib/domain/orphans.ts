import type { Flow, Permission } from "./types";

const MANAGING_ROLES = new Set(["Owner", "CanEdit"]);

/**
 * A flow is orphaned when nobody with an active account can still manage it:
 * the owner is disabled or deleted and there is no active co-owner/editor.
 * Such flows keep running on stale connections until they break, and nobody
 * gets the failure emails.
 */
export function isOrphaned(flow: Flow, permissions: Permission[]): boolean {
  if (flow.owner.status === "active") {
    return false;
  }

  return !permissions.some(
    (permission) => MANAGING_ROLES.has(permission.role) && permission.principal.status === "active",
  );
}
