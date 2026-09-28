"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { formatDateTime, percent, timeAgo } from "@/lib/format";
import type { Insights } from "@/lib/insights/build";
import { AccountTag, Tag } from "@/components/ui/Status";
import { BarList } from "./BarList";
import { RunsChart } from "./RunsChart";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; insights: Insights; now: number };

export function InsightsView() {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    api<{ insights: Insights; generatedAt: string }>("/api/insights", { signal: controller.signal })
      .then((body) =>
        setLoad({ status: "ready", insights: body.insights, now: Date.parse(body.generatedAt) }),
      )
      .catch(
        (err: Error) =>
          err.name !== "AbortError" && setLoad({ status: "error", message: err.message }),
      );
    return () => controller.abort();
  }, []);

  if (load.status === "loading") {
    return <p className="px-4 py-12 font-mono text-xs text-muted sm:px-6">Loading insights…</p>;
  }
  if (load.status === "error") {
    return <p className="px-4 py-12 font-mono text-xs text-fail sm:px-6">{load.message}</p>;
  }

  const { insights, now } = load;
  const runs = insights.daily.reduce((sum, day) => sum + day.succeeded + day.failed, 0);
  const failed = insights.daily.reduce((sum, day) => sum + day.failed, 0);

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="px-4 pt-6 pb-4 sm:px-6">
        <h1 className="text-xl font-medium">Insights</h1>
        <p className="mt-0.5 text-xs text-muted">
          Where the tenant is failing, and who owns the risk.
        </p>
      </div>

      <div className="grid border-t border-rule lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="lg:border-r lg:border-rule">
          <Section title="Runs per day" meta="last 14 days">
            <p className="mb-4">
              <span className="text-3xl text-ink">{percent(runs - failed, runs)}</span>
              <span className="ml-2 text-xs text-muted">
                succeeded · {failed.toLocaleString("en")} of {runs.toLocaleString("en")} runs failed
              </span>
            </p>
            <RunsChart daily={insights.daily} />
          </Section>

          <Section title="Most common errors" meta="last 7 days">
            {insights.commonErrors.length === 0 ? (
              <p className="text-muted">No failed runs. Nice.</p>
            ) : (
              <ol className="-mx-4 divide-y divide-rule border-y border-rule sm:-mx-6">
                {insights.commonErrors.map((error) => (
                  <li
                    key={`${error.code}|${error.action}`}
                    className="grid gap-1 px-4 py-3 sm:px-6"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="font-mono text-xs">
                        <span className="text-fail">{error.code}</span>
                        {error.action && (
                          <>
                            <span className="text-muted"> at </span>
                            <span className="text-ink-2">{error.action}</span>
                          </>
                        )}
                      </p>
                      <p className="tabular font-mono text-xs text-muted">
                        <span className="text-ink">{error.count}</span> runs ·{" "}
                        <span className="text-ink">{error.flows}</span>{" "}
                        {error.flows === 1 ? "flow" : "flows"} ·{" "}
                        <span title={formatDateTime(error.lastSeen)}>
                          {timeAgo(error.lastSeen, now)}
                        </span>
                      </p>
                    </div>
                    <p className="text-xs break-words text-muted">{error.example}</p>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="border-t border-rule lg:border-t-0">
          <Section title="Most failing flows" meta="failed runs, 7 days">
            <BarList
              highlightAll
              items={insights.topFailing.map((flow) => ({
                key: flow.id,
                label: flow.name,
                href: `/flows/${flow.id}`,
                value: flow.failures,
                detail: `${flow.failures} / ${flow.runs}`,
              }))}
            />
          </Section>

          <Section title="Ownership risk" meta="owners who left">
            {insights.ownershipRisk.length === 0 ? (
              <p className="text-muted">Every flow owner has an active account.</p>
            ) : (
              <ul className="-mx-4 divide-y divide-rule border-y border-rule sm:-mx-6">
                {insights.ownershipRisk.map((entry) => (
                  <li
                    key={entry.owner.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/?owner=${encodeURIComponent(entry.owner.email)}`}
                          className="truncate text-ink hover:underline"
                        >
                          {entry.owner.displayName}
                        </Link>
                        <AccountTag status={entry.owner.status} />
                      </div>
                      <p className="tabular font-mono text-xs text-muted">
                        {entry.flows} {entry.flows === 1 ? "flow" : "flows"} · {entry.failing}{" "}
                        failing
                      </p>
                    </div>
                    {entry.orphaned > 0 && <Tag tone="warn">{`${entry.orphaned} ORPHANED`}</Tag>}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/?orphaned=1"
              className="mt-3 inline-block text-xs text-accent hover:underline"
            >
              Show all orphaned flows
            </Link>
          </Section>

          <Section title="Connectors" meta="flows using each">
            <div className="mb-3 flex gap-4 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-fail-mark" /> With failures
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-muted" /> Healthy
              </span>
            </div>
            <BarList
              items={insights.connectors.map((connector) => ({
                key: connector.name,
                label: connector.name,
                href: `/?connector=${encodeURIComponent(connector.name)}`,
                value: connector.flows,
                highlighted: connector.failing,
                detail: `${connector.failing} of ${connector.flows} failing`,
              }))}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule px-4 py-5 sm:px-6">
      <h2 className="mb-4 font-medium">
        {title}
        <span className="ml-2 font-mono text-xs font-normal text-muted">{meta}</span>
      </h2>
      {children}
    </section>
  );
}
