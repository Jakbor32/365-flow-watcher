"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { withGrant, withoutPermission } from "@/lib/access/overlay";
import { api, type Session } from "@/lib/api/client";
import { isOrphaned } from "@/lib/domain/orphans";
import type { FlowWithHealth, Permission } from "@/lib/domain/types";
import { INVENTORY_QUERY_KEY } from "@/lib/flows/filter";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Sparkline } from "@/components/ui/Sparkline";
import { FlowStateLabel } from "@/components/ui/Status";
import { FailuresCell } from "@/components/flows/FlowCells";
import { AccessPanel } from "./AccessPanel";
import { OrphanRecovery } from "./OrphanRecovery";
import { RunHistory } from "./RunHistory";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string; notFound: boolean }
  | { status: "ready"; flow: FlowWithHealth; now: number };

export function FlowDetail({ flowId }: { flowId: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<Permission[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recoveredBy, setRecoveredBy] = useState<string | null>(null);
  const backHref = useSyncExternalStore(noSubscribe, readBackHref, () => "/");
  // Grants that exist only on this screen (demo mode saves nothing).
  const localGrants = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    api<{ flow: FlowWithHealth; generatedAt: string }>(`/api/flows/${flowId}`, { signal })
      .then((body) =>
        setLoad({ status: "ready", flow: body.flow, now: Date.parse(body.generatedAt) }),
      )
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoad({
          status: "error",
          message: err.message,
          notFound: err.status === 404 || err.status === 400,
        });
      });
    api<{ permissions: Permission[] }>(`/api/flows/${flowId}/permissions`, { signal })
      .then((body) => setPermissions(body.permissions))
      .catch(() => setPermissions([]));
    api<Session>("/api/session", { signal })
      .then(setSession)
      .catch(() => setSession(null));
    return () => controller.abort();
  }, [flowId]);

  const orphaned = useMemo(
    () => (load.status === "ready" && permissions ? isOrphaned(load.flow, permissions) : false),
    [load, permissions],
  );

  const simulatedNote = session?.access.simulated ? " Demo: nothing was saved." : "";

  const grant = async (email: string) => {
    const result = await api<{ permission: Permission; simulated: boolean }>(
      `/api/flows/${flowId}/permissions`,
      { method: "POST", body: { email } },
    );
    if (
      !permissions?.some((permission) => permission.principal.id === result.permission.principal.id)
    ) {
      localGrants.current.add(result.permission.id);
    }
    setPermissions((current) => withGrant(current ?? [], result.permission));
    setNotice(`${result.permission.principal.displayName} is now a co-owner.${simulatedNote}`);
    return result.permission;
  };

  const revoke = async (permission: Permission) => {
    // A grant made on this screen in demo mode never reached the server.
    if (!localGrants.current.delete(permission.id)) {
      await api(`/api/flows/${flowId}/permissions/${permission.id}`, { method: "DELETE" });
    }
    setPermissions((current) => withoutPermission(current ?? [], permission.id));
    // Removing the person who recovered the flow makes it orphaned again.
    if (permission.principal.displayName === recoveredBy) setRecoveredBy(null);
    setNotice(`${permission.principal.displayName} no longer has access.${simulatedNote}`);
  };

  if (load.status === "loading") {
    return <p className="px-4 py-12 font-mono text-xs text-muted sm:px-6">Loading flow…</p>;
  }

  if (load.status === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-lg font-medium">
          {load.notFound ? "Flow not found" : "Could not load flow"}
        </h1>
        <p className="mt-2 font-mono text-xs text-fail">{load.message}</p>
        <Link href={backHref} className="mt-6 inline-block text-accent hover:underline">
          Back to flows
        </Link>
      </div>
    );
  }

  const { flow, now } = load;

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="px-4 pt-5 pb-4 sm:px-6">
        <Link
          href={backHref}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rule-2 px-3 text-sm whitespace-nowrap text-ink-2 hover:bg-paper-3 hover:text-ink"
        >
          <span aria-hidden>←</span> Back to flows
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-medium">{flow.displayName}</h1>
            <p className="mt-1 text-xs text-muted">
              {flow.trigger.label} · {flow.connectors.join(", ")}
            </p>
          </div>
          <FlowStateLabel state={flow.state} />
        </div>
      </div>

      <dl className="grid grid-cols-2 border-y border-rule sm:grid-cols-4">
        {[
          ["Failed · 7d", <FailuresCell key="f" flow={flow} />],
          ["14 days", <Sparkline key="s" daily={flow.daily} />],
          [
            "Owner",
            <span key="o" className="truncate text-ink-2">
              {flow.owner.displayName}
            </span>,
          ],
          [
            "Modified",
            <span key="m" className="font-mono text-xs" title={formatDateTime(flow.modifiedAt)}>
              {timeAgo(flow.modifiedAt, now)}
            </span>,
          ],
        ].map(([label, value], index) => (
          <div
            key={label as string}
            className={`flex min-w-0 flex-col gap-1.5 border-rule px-4 py-3 sm:px-6 ${index % 2 === 0 ? "border-r" : "sm:border-r"} ${index > 1 ? "border-t sm:border-t-0" : ""}`}
          >
            <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">{label}</dt>
            <dd className="min-w-0">{value}</dd>
          </div>
        ))}
      </dl>

      {(orphaned || recoveredBy) && permissions && (
        <OrphanRecovery
          flow={flow}
          permissions={permissions}
          canManage={session?.access.canManage ?? false}
          onGrant={grant}
          recoveredBy={recoveredBy}
          onRecovered={setRecoveredBy}
        />
      )}

      {notice && (
        <p role="status" className="border-b border-rule bg-accent-wash px-4 py-2 text-sm sm:px-6">
          {notice}
        </p>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="lg:border-r lg:border-rule">
          <RunHistory flowId={flow.id} now={now} />
        </div>
        <div className="border-t border-rule lg:border-t-0">
          <AccessPanel
            flow={flow}
            permissions={permissions}
            session={session}
            onGrant={grant}
            onRevoke={revoke}
          />
          <dl className="grid gap-3 px-4 py-4 text-xs sm:px-6">
            <div>
              <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">Flow ID</dt>
              <dd className="font-mono break-all text-ink-2">{flow.id}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">Created</dt>
              <dd className="font-mono text-ink-2">{formatDateTime(flow.createdAt)}</dd>
            </div>
            <div>
              {session?.mode === "demo" ? (
                <span className="text-muted">
                  Open in Power Automate (not available in the demo)
                </span>
              ) : (
                <a
                  href={flow.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Open in Power Automate ↗
                </a>
              )}
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

const noSubscribe = () => () => {};

function readBackHref(): string {
  try {
    const query = sessionStorage.getItem(INVENTORY_QUERY_KEY);
    return query ? `/?${query}` : "/";
  } catch {
    return "/";
  }
}
