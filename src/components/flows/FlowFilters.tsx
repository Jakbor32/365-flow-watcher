import type { FlowQuery, HealthFilter } from "@/lib/flows/filter";
import type { FlowState } from "@/lib/domain/types";

interface Props {
  query: FlowQuery;
  owners: { email: string; name: string }[];
  connectors: string[];
  onChange: (patch: Partial<FlowQuery>) => void;
  layout: "inline" | "stacked";
}

const selectClass =
  "h-8 min-w-0 rounded-md border border-rule bg-paper-2 px-2 text-sm text-ink-2 transition-colors duration-150 hover:border-rule-2";

export function FlowFilters({ query, owners, connectors, onChange, layout }: Props) {
  const field = (label: string, control: React.ReactNode) => (
    <label
      className={layout === "stacked" ? "flex flex-col gap-1.5" : "flex min-w-0 items-center gap-2"}
    >
      <span className="text-muted font-mono text-[11px] tracking-wide whitespace-nowrap uppercase">
        {label}
      </span>
      {control}
    </label>
  );

  return (
    <div
      className={
        layout === "stacked" ? "grid gap-4" : "flex flex-wrap items-center gap-x-4 gap-y-2"
      }
    >
      {field(
        "State",
        <select
          className={selectClass}
          value={query.state}
          onChange={(event) => onChange({ state: event.target.value as FlowState | "all" })}
        >
          <option value="all">Any</option>
          <option value="enabled">On</option>
          <option value="disabled">Off</option>
          <option value="suspended">Suspended</option>
        </select>,
      )}
      {field(
        "Runs · 7d",
        <select
          className={selectClass}
          value={query.health}
          onChange={(event) => onChange({ health: event.target.value as HealthFilter })}
        >
          <option value="all">Any</option>
          <option value="failing">With failures</option>
          <option value="healthy">All succeeded</option>
          <option value="idle">No runs</option>
        </select>,
      )}
      {field(
        "Owner",
        <select
          className={`${selectClass} ${layout === "inline" ? "max-w-48" : ""}`}
          value={query.owner}
          onChange={(event) => onChange({ owner: event.target.value })}
        >
          <option value="">Anyone</option>
          {owners.map((owner) => (
            <option key={owner.email} value={owner.email}>
              {owner.name}
            </option>
          ))}
        </select>,
      )}
      {field(
        "Connector",
        <select
          className={`${selectClass} ${layout === "inline" ? "max-w-44" : ""}`}
          value={query.connector}
          onChange={(event) => onChange({ connector: event.target.value })}
        >
          <option value="">Any</option>
          {connectors.map((connector) => (
            <option key={connector}>{connector}</option>
          ))}
        </select>,
      )}
      <label className="flex items-center gap-2 whitespace-nowrap">
        <input
          type="checkbox"
          checked={query.orphanedOnly}
          onChange={(event) => onChange({ orphanedOnly: event.target.checked })}
          className="accent-accent size-4"
        />
        <span className="text-ink-2 text-sm">Orphaned only</span>
      </label>
    </div>
  );
}
