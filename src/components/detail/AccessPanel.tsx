"use client";

import { useState } from "react";
import type { Session } from "@/lib/api/client";
import type { FlowWithHealth, Permission } from "@/lib/domain/types";
import { AccountTag } from "@/components/ui/Status";
import { Dialog, buttonClass } from "@/components/ui/Dialog";
import { PersonPicker } from "./PersonPicker";

interface Props {
  flow: FlowWithHealth;
  permissions: Permission[] | null;
  session: Session | null;
  onGrant: (email: string) => Promise<Permission>;
  onRevoke: (permission: Permission) => Promise<void>;
}

const ROLE_LABEL: Record<Permission["role"], string> = {
  Owner: "Owner",
  CanEdit: "Co-owner",
  CanView: "Run only",
};

export function AccessPanel({ flow, permissions, session, onGrant, onRevoke }: Props) {
  const [granting, setGranting] = useState(false);
  const [email, setEmail] = useState("");
  const [revoking, setRevoking] = useState<Permission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = session?.access.canManage ?? false;
  const holders = new Set(
    (permissions ?? [])
      .filter((permission) => permission.role !== "CanView")
      .map((permission) => permission.principal.id),
  );

  const run = async (work: () => Promise<unknown>, done: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      done();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="access-title">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <h2 id="access-title" className="font-medium">
          Access
        </h2>
        {canManage && (
          <button type="button" onClick={() => setGranting(true)} className={buttonClass.secondary}>
            Grant access
          </button>
        )}
      </div>

      {permissions === null ? (
        <p className="border-t border-rule px-4 py-4 font-mono text-xs text-muted sm:px-6">
          Loading…
        </p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {permissions.map((permission) => {
            const primary = permission.principal.id === flow.owner.id;
            return (
              <li key={permission.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-ink">{permission.principal.displayName}</span>
                    <AccountTag status={permission.principal.status} />
                  </div>
                  <p className="truncate font-mono text-xs text-muted">
                    {permission.principal.email}
                  </p>
                </div>
                <span className="font-mono text-xs whitespace-nowrap text-muted">
                  {primary ? "Primary owner" : ROLE_LABEL[permission.role]}
                </span>
                {canManage && !primary && (
                  <button
                    type="button"
                    onClick={() => setRevoking(permission)}
                    aria-label={`Remove ${permission.principal.displayName}`}
                    className={buttonClass.quiet}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {session && !canManage && session.access.reason && (
        <p className="px-4 py-3 text-xs text-muted sm:px-6">{session.access.reason}</p>
      )}

      <Dialog
        open={granting}
        onClose={() => {
          setGranting(false);
          setError(null);
        }}
        title="Grant access"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => onGrant(email),
              () => {
                setGranting(false);
                setEmail("");
              },
            );
          }}
          className="grid gap-4"
        >
          <PersonPicker value={email} onChange={setEmail} exclude={holders} />
          <p className="text-xs text-muted">
            They become a co-owner of <span className="text-ink-2">{flow.displayName}</span>: they
            can edit it, turn it off and see its run history.
          </p>
          {error && <p className="font-mono text-xs text-fail">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setGranting(false)} className={buttonClass.quiet}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !email.includes("@")}
              className={buttonClass.primary}
            >
              {busy ? "Granting…" : "Grant co-owner"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={revoking !== null}
        onClose={() => {
          setRevoking(null);
          setError(null);
        }}
        title="Remove access"
      >
        {revoking && (
          <div className="grid gap-4">
            <p>
              Remove <span className="text-ink">{revoking.principal.displayName}</span> from{" "}
              <span className="text-ink">{flow.displayName}</span>? They will no longer be able to
              edit or run it.
            </p>
            {error && <p className="font-mono text-xs text-fail">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRevoking(null)} className={buttonClass.quiet}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => onRevoke(revoking),
                    () => setRevoking(null),
                  )
                }
                className={buttonClass.danger}
              >
                {busy ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
