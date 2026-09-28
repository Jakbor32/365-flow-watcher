import { percent } from "@/lib/format";
import type { FlowQuery, FlowSummary } from "@/lib/flows/filter";

interface Props {
  summary: FlowSummary;
  query: FlowQuery;
  onApply: (patch: Partial<FlowQuery>) => void;
}

/** Whole-tenant numbers. Each one is also a one-click filter. */
export function SummaryStrip({ summary, query, onApply }: Props) {
  const success = summary.runs - summary.failures;
  const items = [
    {
      label: "Flows",
      value: summary.total,
      active: false,
      apply: { state: "all", health: "all", orphanedOnly: false } as const,
    },
    {
      label: "Enabled",
      value: summary.enabled,
      active: query.state === "enabled",
      apply: { state: "enabled" } as const,
    },
    {
      label: "Failing · 7d",
      value: summary.failing,
      tone: summary.failing > 0 ? "text-fail" : undefined,
      active: query.health === "failing",
      apply: { health: "failing" } as const,
    },
    {
      label: "Orphaned",
      value: summary.orphaned,
      tone: summary.orphaned > 0 ? "text-warn" : undefined,
      active: query.orphanedOnly,
      apply: { orphanedOnly: true },
    },
  ];

  return (
    <div className="grid grid-cols-2 border-y border-rule sm:grid-cols-5">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-pressed={item.active}
          onClick={() => onApply(item.apply)}
          className="flex flex-col items-start gap-0.5 border-rule px-4 py-3 text-left transition-colors duration-150 odd:border-r hover:bg-paper-2 aria-pressed:bg-paper-3 sm:border-r sm:px-6"
        >
          <span className="font-mono text-[11px] tracking-wide whitespace-nowrap text-muted uppercase">
            {item.label}
          </span>
          <span className={`tabular font-mono text-2xl text-ink ${item.tone ?? ""}`}>
            {item.value}
          </span>
        </button>
      ))}
      <div className="col-span-2 flex flex-col gap-0.5 border-t border-rule px-4 py-3 sm:col-span-1 sm:border-t-0 sm:px-6">
        <span className="font-mono text-[11px] tracking-wide whitespace-nowrap text-muted uppercase">
          Run success · 7d
        </span>
        <span className="tabular font-mono text-2xl text-ink">
          {percent(success, summary.runs)}
          <span className="ml-2 text-xs text-muted">
            {summary.failures} of {summary.runs} failed
          </span>
        </span>
      </div>
    </div>
  );
}
