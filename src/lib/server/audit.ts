import "server-only";

export interface AuditEvent {
  action: "access.grant" | "access.revoke";
  actor: string;
  flowId: string;
  target: string;
  role?: string;
  simulated: boolean;
}

/**
 * One JSON line per change on stdout, so `docker logs` or any log collector
 * keeps a record of who changed access to which flow.
 */
export function audit(event: AuditEvent) {
  console.info(JSON.stringify({ type: "audit", at: new Date().toISOString(), ...event }));
}
