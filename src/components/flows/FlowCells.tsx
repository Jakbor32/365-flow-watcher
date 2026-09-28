import type { FlowWithHealth } from "@/lib/domain/types";
import { formatDateTime, percent, timeAgo } from "@/lib/format";
import { AccountTag, RunDot, Tag } from "@/components/ui/Status";

export function OwnerCell({ flow }: { flow: FlowWithHealth }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={`truncate ${flow.owner.status === "active" ? "text-ink-2" : "text-muted decoration-rule-2 line-through"}`}
      >
        {flow.owner.displayName}
      </span>
      <AccountTag status={flow.owner.status} />
      {flow.orphaned && (
        <Tag tone="warn" title="Nobody with an active account can manage this flow">
          ORPHANED
        </Tag>
      )}
    </div>
  );
}

export function LastRunCell({ flow, now }: { flow: FlowWithHealth; now: number }) {
  if (!flow.lastRun) return <span className="text-muted font-mono text-xs">never</span>;
  return (
    <span
      className="inline-flex items-center gap-2 font-mono text-xs whitespace-nowrap"
      title={`${flow.lastRun.status} · ${formatDateTime(flow.lastRun.startTime)}`}
    >
      <RunDot status={flow.lastRun.status} />
      <span className="sr-only">{flow.lastRun.status}, </span>
      {timeAgo(flow.lastRun.startTime, now)}
    </span>
  );
}

export function FailuresCell({ flow }: { flow: FlowWithHealth }) {
  if (flow.recentRuns === 0) return <span className="text-muted font-mono text-xs">no runs</span>;
  return (
    <span className="tabular font-mono text-xs whitespace-nowrap">
      <span className={flow.recentFailures > 0 ? "text-fail" : "text-muted"}>
        {flow.recentFailures}
      </span>
      <span className="text-muted"> / {flow.recentRuns}</span>
      {flow.recentFailures > 0 && (
        <span className="text-muted ml-1.5">{percent(flow.recentFailures, flow.recentRuns)}</span>
      )}
    </span>
  );
}
