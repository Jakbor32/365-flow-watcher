import Link from "next/link";
import type { FlowWithHealth } from "@/lib/domain/types";
import type { FlowQuery, SortKey } from "@/lib/flows/filter";
import { Sparkline } from "@/components/ui/Sparkline";
import { FlowStateLabel } from "@/components/ui/Status";
import { FailuresCell, LastRunCell, OwnerCell } from "./FlowCells";

interface Props {
  flows: FlowWithHealth[];
  query: FlowQuery;
  now: number;
  onSort: (key: SortKey) => void;
}

export function FlowTable({ flows, query, now, onSort }: Props) {
  const header = (key: SortKey | null, label: string, className = "") => {
    const active = key !== null && query.sort === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (query.descending ? "descending" : "ascending") : undefined}
        className={`h-9 px-3 text-left font-mono text-[11px] font-normal tracking-wide whitespace-nowrap text-muted uppercase ${className}`}
      >
        {key ? (
          <button
            type="button"
            onClick={() => onSort(key)}
            className={`inline-flex items-center gap-1 uppercase hover:text-ink ${active ? "text-ink" : ""}`}
          >
            {label}
            <span aria-hidden className={active ? "text-accent" : "invisible"}>
              {query.descending ? "↓" : "↑"}
            </span>
          </button>
        ) : (
          label
        )}
      </th>
    );
  };

  return (
    <table className="w-full table-fixed border-collapse">
      <thead className="sticky top-12 z-10 border-b border-rule bg-paper">
        <tr>
          {header("name", "Flow", "w-[34%] pl-4 sm:pl-6")}
          {header(null, "State", "w-20")}
          {header("owner", "Owner", "w-[20%]")}
          {header("lastRun", "Last run", "w-28")}
          {header("failures", "Failed · 7d", "w-36")}
          {header(null, "14 days", "w-24")}
          {header(null, "Connectors", "hidden xl:table-cell pr-6")}
        </tr>
      </thead>
      <tbody>
        {flows.map((flow) => (
          <tr
            key={flow.id}
            className="relative border-b border-rule transition-colors duration-100 hover:bg-paper-2"
          >
            <td className="py-2.5 pr-3 pl-4 align-top sm:pl-6">
              {/* The link covers the whole row; other cells hold no controls. */}
              <Link
                href={`/flows/${flow.id}`}
                title={flow.displayName}
                className="block truncate font-medium text-ink before:absolute before:inset-0 hover:underline"
              >
                {flow.displayName}
              </Link>
              <div className="truncate text-xs text-muted">{flow.trigger.label}</div>
            </td>
            <td className="px-3 py-2.5 align-top">
              <FlowStateLabel state={flow.state} />
            </td>
            <td className="px-3 py-2.5 align-top">
              <OwnerCell flow={flow} />
            </td>
            <td className="px-3 py-2.5 align-top">
              <LastRunCell flow={flow} now={now} />
            </td>
            <td className="px-3 py-2.5 align-top">
              <FailuresCell flow={flow} />
            </td>
            <td className="px-3 py-3 align-top">
              <Sparkline daily={flow.daily} />
            </td>
            <td className="hidden truncate px-3 py-2.5 pr-6 align-top text-xs text-muted xl:table-cell">
              {flow.connectors.join(", ")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
