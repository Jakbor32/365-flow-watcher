"use client";

import { useState } from "react";
import type { DailyRuns } from "@/lib/domain/types";
import { percent } from "@/lib/format";

const HEIGHT = 180;

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

/** Stacked columns: succeeded (neutral) under failed (red), one per day. */
export function RunsChart({ daily }: { daily: DailyRuns[] }) {
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(1, ...daily.map((day) => day.succeeded + day.failed));
  const ticks = niceTicks(peak);
  const top = ticks[ticks.length - 1];

  return (
    <figure className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <Key className="bg-muted" label="Succeeded" />
        <Key className="bg-fail-mark" label="Failed" />
      </div>

      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        {/* Y axis */}
        <div className="relative w-9" style={{ height: HEIGHT }} aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="tabular absolute right-0 -translate-y-1/2 font-mono text-[10px] text-muted"
              style={{ top: HEIGHT - (tick / top) * HEIGHT }}
            >
              {tick.toLocaleString("en")}
            </span>
          ))}
        </div>

        <div className="relative" style={{ height: HEIGHT }}>
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className="absolute inset-x-0 border-t border-rule"
              style={{ top: HEIGHT - (tick / top) * HEIGHT }}
            />
          ))}

          <ol className="absolute inset-0 flex items-end">
            {daily.map((day, index) => {
              const total = day.succeeded + day.failed;
              const okHeight = (day.succeeded / top) * HEIGHT;
              const failHeight = (day.failed / top) * HEIGHT;
              const label = `${dayLabel.format(new Date(day.day))}: ${day.failed} failed, ${day.succeeded} succeeded`;
              return (
                <li
                  key={day.day}
                  tabIndex={0}
                  aria-label={label}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  // The whole day slot is the hit target, not just the painted bar.
                  className="flex h-full flex-1 flex-col items-center justify-end px-px outline-offset-0"
                >
                  <div
                    className={`flex w-full max-w-6 flex-col transition-opacity duration-100 ${active !== null && active !== index ? "opacity-50" : ""}`}
                  >
                    {day.failed > 0 && (
                      <div
                        className="rounded-t bg-fail-mark"
                        style={{ height: Math.max(2, failHeight) }}
                      />
                    )}
                    {day.failed > 0 && day.succeeded > 0 && <div className="h-0.5" />}
                    {day.succeeded > 0 && (
                      <div
                        className={`bg-muted ${day.failed === 0 ? "rounded-t" : ""}`}
                        style={{ height: Math.max(2, okHeight - (day.failed > 0 ? 2 : 0)) }}
                      />
                    )}
                    {total === 0 && <div className="h-px bg-rule-2" />}
                  </div>
                </li>
              );
            })}
          </ol>

          {active !== null && <Tooltip day={daily[active]} index={active} count={daily.length} />}
        </div>

        {/* X axis: first, middle and last day only */}
        <div />
        <div className="flex justify-between font-mono text-[10px] text-muted" aria-hidden>
          {[0, Math.floor(daily.length / 2), daily.length - 1].map((index) => (
            <span key={index}>{dayLabel.format(new Date(daily[index].day))}</span>
          ))}
        </div>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <table className="tabular mt-2 w-full font-mono">
          <thead className="text-muted">
            <tr>
              <th className="py-1 text-left font-normal">Day</th>
              <th className="text-right font-normal">Succeeded</th>
              <th className="text-right font-normal">Failed</th>
              <th className="text-right font-normal">Success</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((day) => (
              <tr key={day.day} className="border-t border-rule">
                <td className="py-1">{day.day}</td>
                <td className="text-right">{day.succeeded}</td>
                <td className="text-right">{day.failed}</td>
                <td className="text-right">{percent(day.succeeded, day.succeeded + day.failed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Tooltip({ day, index, count }: { day: DailyRuns; index: number; count: number }) {
  const left = ((index + 0.5) / count) * 100;
  const total = day.succeeded + day.failed;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-md border border-rule-2 bg-paper-2 px-3 py-2 text-xs shadow-sm"
      style={{ left: `clamp(5rem, ${left}%, calc(100% - 5rem))` }}
    >
      <p className="text-muted">
        {weekday.format(new Date(day.day))} {dayLabel.format(new Date(day.day))}
      </p>
      <p className="mt-1 flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3 bg-fail-mark" />
        <span className="tabular font-mono font-medium text-ink">{day.failed}</span>
        <span className="text-muted">failed</span>
      </p>
      <p className="flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3 bg-muted" />
        <span className="tabular font-mono font-medium text-ink">{day.succeeded}</span>
        <span className="text-muted">succeeded</span>
      </p>
      <p className="mt-1 text-muted">{percent(day.succeeded, total)} success</p>
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

/** 0 plus 3-4 round steps covering `max`. */
export function niceTicks(max: number): number[] {
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10]
    .map((m) => m * magnitude)
    .find((candidate) => candidate >= rough)!;
  const ticks = [];
  for (let tick = 0; tick < max + step; tick += step) ticks.push(tick);
  return ticks;
}
