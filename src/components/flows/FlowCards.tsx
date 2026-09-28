import type { FlowWithHealth } from "@/lib/domain/types";
import { Sparkline } from "@/components/ui/Sparkline";
import { FlowStateLabel } from "@/components/ui/Status";
import { FailuresCell, LastRunCell, OwnerCell } from "./FlowCells";

/** Phone layout: one flow per block, same facts as the table row. */
export function FlowCards({ flows, now }: { flows: FlowWithHealth[]; now: number }) {
  return (
    <ul className="divide-rule border-rule divide-y border-b">
      {flows.map((flow) => (
        <li key={flow.id} className="grid gap-2 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ink font-medium break-words">{flow.displayName}</p>
              <p className="text-muted text-xs">{flow.trigger.label}</p>
            </div>
            <FlowStateLabel state={flow.state} />
          </div>
          <OwnerCell flow={flow} />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-center gap-4">
              <LastRunCell flow={flow} now={now} />
              <FailuresCell flow={flow} />
            </div>
            <Sparkline daily={flow.daily} />
          </div>
        </li>
      ))}
    </ul>
  );
}
