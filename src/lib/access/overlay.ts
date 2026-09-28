import type { Permission } from "@/lib/domain/types";

// Client-side view of access after grant/revoke. In demo mode the server
// saves nothing, so this is also what keeps the change visible on screen.

export function withGrant(permissions: Permission[], granted: Permission): Permission[] {
  const others = permissions.filter(
    (permission) => permission.principal.id !== granted.principal.id,
  );
  return [...others, granted];
}

export function withoutPermission(permissions: Permission[], removedId: string): Permission[] {
  return permissions.filter((permission) => permission.id !== removedId);
}
