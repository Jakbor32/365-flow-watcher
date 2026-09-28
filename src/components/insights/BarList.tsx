import Link from "next/link";

export interface BarItem {
  key: string;
  label: string;
  href?: string;
  value: number;
  /** Part of `value` drawn in red, e.g. failing flows out of all flows. */
  highlighted?: number;
  detail: string;
}

/** Horizontal bars with the label above and the value at the bar's end. */
export function BarList({
  items,
  highlightAll = false,
}: {
  items: BarItem[];
  highlightAll?: boolean;
}) {
  const peak = Math.max(1, ...items.map((item) => item.value));
  return (
    <ol className="grid gap-3">
      {items.map((item) => {
        const width = (item.value / peak) * 100;
        const red = highlightAll ? item.value : (item.highlighted ?? 0);
        const redShare = item.value === 0 ? 0 : (red / item.value) * 100;
        return (
          <li key={item.key} className="grid gap-1">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              {item.href ? (
                <Link
                  href={item.href}
                  className="truncate text-ink-2 hover:text-ink hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate text-ink-2">{item.label}</span>
              )}
              <span className="tabular shrink-0 font-mono text-xs text-muted">{item.detail}</span>
            </div>
            <div className="h-2" title={item.detail}>
              <div
                className="flex h-full overflow-hidden rounded-r"
                style={{ width: `${Math.max(width, 1)}%` }}
              >
                {red > 0 && (
                  <div className="h-full bg-fail-mark" style={{ width: `${redShare}%` }} />
                )}
                {red > 0 && red < item.value && <div className="h-full w-0.5 shrink-0" />}
                {red < item.value && <div className="h-full flex-1 bg-muted" />}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
