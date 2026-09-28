import type { AccountStatus, FlowState, RunStatus } from "@/lib/domain/types";

const RUN_COLOR: Record<RunStatus, string> = {
  Succeeded: "bg-ok",
  Failed: "bg-fail",
  Cancelled: "bg-idle",
  Running: "bg-accent",
};

export function RunDot({ status }: { status: RunStatus }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-1.5 shrink-0 rounded-full ${RUN_COLOR[status]}`}
    />
  );
}

const STATE_STYLE: Record<FlowState, { label: string; className: string }> = {
  enabled: { label: "On", className: "text-ink-2" },
  disabled: { label: "Off", className: "text-muted" },
  suspended: { label: "Suspended", className: "text-warn" },
};

export function FlowStateLabel({ state }: { state: FlowState }) {
  const { label, className } = STATE_STYLE[state];
  return <span className={`font-mono text-xs whitespace-nowrap ${className}`}>{label}</span>;
}

/** Small uppercase mono tag, e.g. DISABLED or ORPHANED. */
export function Tag({
  tone,
  children,
  title,
}: {
  tone: "fail" | "warn";
  children: string;
  title?: string;
}) {
  const color = tone === "fail" ? "text-fail bg-fail-wash" : "text-warn bg-warn-wash";
  return (
    <span
      title={title}
      className={`rounded-sm px-1 py-px font-mono text-[10px] font-medium tracking-wider whitespace-nowrap ${color}`}
    >
      {children}
    </span>
  );
}

export function AccountTag({ status }: { status: AccountStatus }) {
  if (status === "active") return null;
  return (
    <Tag tone="fail" title={`Owner account is ${status} in Entra ID`}>
      {status.toUpperCase()}
    </Tag>
  );
}
