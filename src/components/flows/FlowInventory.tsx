"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlowWithHealth } from "@/lib/domain/types";
import { csvFileName, toCsv } from "@/lib/flows/csv";
import {
  DEFAULT_QUERY,
  activeFilterCount,
  facets,
  filterFlows,
  parseQuery,
  serializeQuery,
  summarize,
  type FlowQuery,
  type SortKey,
} from "@/lib/flows/filter";
import { FlowCards } from "./FlowCards";
import { FlowFilters } from "./FlowFilters";
import { FlowTable } from "./FlowTable";
import { SummaryStrip } from "./SummaryStrip";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; flows: FlowWithHealth[]; generatedAt: number };

export function FlowInventory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useMemo(() => parseQuery(new URLSearchParams(searchParams)), [searchParams]);

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const drawer = useRef<HTMLDialogElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/flows", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
        setLoad({ status: "ready", flows: body.flows, generatedAt: Date.parse(body.generatedAt) });
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoad({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [attempt]);

  // "/" jumps to search, like most admin consoles.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !target.closest("input, select, textarea")) {
        event.preventDefault();
        searchBox.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const update = useCallback(
    (patch: Partial<FlowQuery>) => {
      const params = serializeQuery({ ...query, ...patch }).toString();
      router.replace(params ? `${pathname}?${params}` : pathname, { scroll: false });
    },
    [pathname, query, router],
  );

  const sortBy = (key: SortKey) =>
    update({
      sort: key,
      descending: query.sort === key ? !query.descending : key !== "name" && key !== "owner",
    });

  const flows = useMemo(() => (load.status === "ready" ? load.flows : []), [load]);
  const visible = useMemo(() => filterFlows(flows, query), [flows, query]);
  const summary = useMemo(() => summarize(flows), [flows]);
  const { owners, connectors } = useMemo(() => facets(flows), [flows]);
  const filterCount = activeFilterCount(query);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: csvFileName() });
    link.click();
    URL.revokeObjectURL(url);
  };

  if (load.status === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-lg font-medium">Could not load flows</h1>
        <p className="text-fail mt-2 font-mono text-xs">{load.message}</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
          className="border-rule-2 text-ink hover:bg-paper-3 mt-6 h-8 rounded-md border px-3"
        >
          Try again
        </button>
      </div>
    );
  }

  const filters = (layout: "inline" | "stacked") => (
    <FlowFilters
      query={query}
      owners={owners}
      connectors={connectors}
      onChange={update}
      layout={layout}
    />
  );

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 pb-4 sm:px-6">
        <div>
          <h1 className="text-xl font-medium">Flows</h1>
          <p className="text-muted mt-0.5 text-xs">
            Every cloud flow in the environment, worst first.
          </p>
        </div>
      </div>

      {load.status === "ready" ? (
        <SummaryStrip summary={summary} query={query} onApply={update} />
      ) : (
        <div aria-hidden className="border-rule bg-paper-2 h-[74px] border-y" />
      )}

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Search flows</span>
          <input
            ref={searchBox}
            type="search"
            value={query.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Search name, owner or flow ID"
            className="border-rule bg-paper-2 text-ink placeholder:text-muted hover:border-rule-2 h-8 w-full rounded-md border pr-8 pl-3 text-sm"
          />
          <kbd className="border-rule text-muted pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[10px] sm:block">
            /
          </kbd>
        </label>

        <button
          type="button"
          onClick={() => drawer.current?.showModal()}
          className="border-rule text-ink-2 hover:border-rule-2 h-8 rounded-md border px-3 whitespace-nowrap lg:hidden"
        >
          Filters
          {filterCount > 0 && <span className="text-accent ml-1.5 font-mono">{filterCount}</span>}
        </button>

        <div className="hidden lg:block">{filters("inline")}</div>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="tabular text-muted font-mono text-xs whitespace-nowrap"
            aria-live="polite"
          >
            {visible.length} of {flows.length}
          </span>
          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            className="border-rule text-ink-2 hover:border-rule-2 hover:text-ink h-8 rounded-md border px-3 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {load.status === "loading" ? (
        <p className="text-muted px-4 py-12 font-mono text-xs sm:px-6">Loading flows…</p>
      ) : visible.length === 0 ? (
        <div className="border-rule border-t px-4 py-12 sm:px-6">
          <p className="text-ink">No flows match these filters.</p>
          <button
            type="button"
            onClick={() =>
              update({ ...DEFAULT_QUERY, sort: query.sort, descending: query.descending })
            }
            className="text-accent mt-3 underline-offset-4 hover:underline"
          >
            Clear filters and search
          </button>
        </div>
      ) : (
        <>
          <div className="border-rule hidden border-t md:block">
            <FlowTable flows={visible} query={query} now={load.generatedAt} onSort={sortBy} />
          </div>
          <div className="border-rule border-t md:hidden">
            <FlowCards flows={visible} now={load.generatedAt} />
          </div>
        </>
      )}

      <dialog
        ref={drawer}
        onClick={(event) => event.target === drawer.current && drawer.current.close()}
        className="border-rule bg-paper text-ink-2 backdrop:bg-scrim mt-auto mb-0 w-full max-w-none rounded-t-xl border p-0"
      >
        <div className="border-rule flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Filters</h2>
          <button
            type="button"
            onClick={() => drawer.current?.close()}
            className="text-accent h-8 px-2"
          >
            Done
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto px-4 py-4">{filters("stacked")}</div>
      </dialog>
    </div>
  );
}
