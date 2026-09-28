"use client";

import { useState } from "react";
import type { FlowWithHealth, Permission } from "@/lib/domain/types";
import { Dialog, buttonClass } from "@/components/ui/Dialog";
import { PersonPicker } from "./PersonPicker";

interface Props {
  flow: FlowWithHealth;
  permissions: Permission[];
  canManage: boolean;
  onGrant: (email: string) => Promise<Permission>;
  /** Set once recovery succeeded; the parent keeps it so this stays visible. */
  recoveredBy: string | null;
  onRecovered: (name: string) => void;
}

/**
 * Orphaned = nobody active can manage the flow. Recovery = make an active
 * person a co-owner, then they fix the connections (only they can, the
 * connections are tied to whoever signs in to them).
 */
export function OrphanRecovery({
  flow,
  permissions,
  canManage,
  onGrant,
  recoveredBy,
  onRecovered,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // People who can already see the flow are the most likely new owners.
  const viewers = permissions
    .filter(
      (permission) => permission.role === "CanView" && permission.principal.status === "active",
    )
    .map((permission) => permission.principal);
  const managers = new Set(
    permissions
      .filter((permission) => permission.role !== "CanView")
      .map((permission) => permission.principal.id),
  );

  if (recoveredBy) {
    return (
      <div className="border-y border-rule bg-accent-wash px-4 py-4 sm:px-6">
        <p className="font-medium text-ink">{recoveredBy} is now a co-owner.</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Ask them to open the flow in Power Automate.</li>
          <li>
            Under <span className="text-ink">Connections</span>, sign in again to every connection
            that belonged to {flow.owner.displayName}.
          </li>
          <li>Save, then turn the flow on if it was turned off.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="border-y border-rule bg-warn-wash px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="font-medium text-warn">Orphaned flow</p>
          <p className="mt-1 text-sm">
            {flow.owner.displayName}&apos;s account is {flow.owner.status} and nobody active can
            manage this flow. It keeps running on their connections until those expire.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setOpen(true)} className={buttonClass.primary}>
            Recover
          </button>
        )}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Recover orphaned flow">
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const permission = await onGrant(email);
              onRecovered(permission.principal.displayName);
              setOpen(false);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm">Pick an active person to take over as co-owner.</p>
          {viewers.length > 0 && (
            <p className="text-xs text-muted">Suggested: people who can already run this flow.</p>
          )}
          <PersonPicker
            value={email}
            onChange={setEmail}
            suggestions={viewers}
            exclude={managers}
          />
          {error && <p className="font-mono text-xs text-fail">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={buttonClass.quiet}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !email.includes("@")}
              className={buttonClass.primary}
            >
              {busy ? "Recovering…" : "Make co-owner"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
