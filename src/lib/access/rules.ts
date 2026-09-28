import type { AppConfig } from "@/lib/config";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/data/source";
import type { Flow, Permission, Person } from "@/lib/domain/types";

export interface AccessCapability {
  canManage: boolean;
  /** Demo mode: allowed, but nothing is written. */
  simulated: boolean;
  reason: string | null;
}

export function accessCapability(config: AppConfig, actorEmail: string): AccessCapability {
  if (config.mode === "demo") {
    return { canManage: true, simulated: true, reason: null };
  }
  if (!config.enableGrantAccess) {
    return {
      canManage: false,
      simulated: false,
      reason: "Grant access is disabled (ENABLE_GRANT_ACCESS)",
    };
  }
  if (!config.accessManagers.includes(actorEmail.trim().toLowerCase())) {
    return { canManage: false, simulated: false, reason: "You are not in ACCESS_MANAGERS" };
  }
  return { canManage: true, simulated: false, reason: null };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEmail(raw: unknown): string {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    throw new BadRequestError("Enter a valid email address or UPN");
  }
  return email;
}

export function parseGuid(raw: string, label: string): string {
  if (!GUID.test(raw)) throw new BadRequestError(`${label} must be a GUID`);
  return raw.toLowerCase();
}

export function assertGrantable(permissions: Permission[], person: Person | null, email: string) {
  if (!person) throw new NotFoundError(`No user ${email} in this tenant`);
  if (person.status !== "active") {
    throw new ConflictError(`${person.displayName}'s account is ${person.status}`);
  }
  // A run-only (CanView) user may be upgraded; an owner or co-owner may not.
  const existing = permissions.find((permission) => permission.principal.id === person.id);
  if (existing && existing.role !== "CanView") {
    throw new ConflictError(`${person.displayName} already has access`);
  }
}

export function assertRevocable(flow: Flow, permissions: Permission[], permissionId: string) {
  const permission = permissions.find((candidate) => candidate.id === permissionId);
  if (!permission) throw new NotFoundError("That person has no access to this flow");
  if (permission.principal.id === flow.owner.id) {
    throw new ConflictError("The primary owner can't be removed");
  }
  return permission;
}
