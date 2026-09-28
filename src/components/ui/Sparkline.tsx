import type { DailyRuns } from "@/lib/domain/types";

const BAR = 3;
const GAP = 1;
const HEIGHT = 18;

/** 14 daily bars: succeeded runs in ink, failures stacked on top in red. */
export function Sparkline({ daily }: { daily: DailyRuns[] }) {
  const peak = Math.max(1, ...daily.map((day) => day.succeeded + day.failed));
  const failed = daily.reduce((sum, day) => sum + day.failed, 0);
  const total = daily.reduce((sum, day) => sum + day.succeeded + day.failed, 0);

  return (
    <svg
      role="img"
      aria-label={`Last ${daily.length} days: ${total} runs, ${failed} failed`}
      width={daily.length * (BAR + GAP) - GAP}
      height={HEIGHT}
      className="block shrink-0"
    >
      {daily.map((day, index) => {
        const x = index * (BAR + GAP);
        const count = day.succeeded + day.failed;
        if (count === 0) {
          return (
            <rect
              key={day.day}
              x={x}
              y={HEIGHT - 1}
              width={BAR}
              height={1}
              className="fill-rule-2"
            />
          );
        }
        // Square-root scale keeps quiet days visible next to busy ones.
        const height = Math.max(2, Math.round(Math.sqrt(count / peak) * HEIGHT));
        const failHeight =
          day.failed === 0 ? 0 : Math.max(1, Math.round((day.failed / count) * height));
        return (
          <g key={day.day}>
            <rect
              x={x}
              y={HEIGHT - height}
              width={BAR}
              height={height - failHeight}
              className="fill-muted"
            />
            {failHeight > 0 && (
              <rect
                x={x}
                y={HEIGHT - height}
                width={BAR}
                height={failHeight}
                className="fill-fail"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
