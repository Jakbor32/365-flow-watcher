"use client";

import Link from "next/link";
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
import { INVENTORY_QUERY_KEY } from "@/lib/flows/filter";
import { api, type Session } from "@/lib/api/client";
import { FlowCards } from "./FlowCards";
import { ViewAs } from "./ViewAs";
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
  const previewAs = searchParams.get("as");
  const [canPreview, setCanPreview] = useState(false);

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const drawer = useRef<HTMLDialogElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    // api() adds the sign-in tokens and the ?as= preview.
    api<{ flows: FlowWithHealth[]; generatedAt: string }>("/api/flows", {
      signal: controller.signal,
    })
      .then((body) =>
        setLoad({ status: "ready", flows: body.flows, generatedAt: Date.parse(body.generatedAt) }),
      )
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoad({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [attempt, previewAs]);

  useEffect(() => {
    api<Session>("/api/session")
      .then((session) => setCanPreview(session.canPreview))
      .catch(() => setCanPreview(false));
  }, []);

  // Remember the view so "← Flows" on a detail page returns to it.
  useEffect(() => {
    try {
      sessionStorage.setItem(INVENTORY_QUERY_KEY, withPreview(serializeQuery(query), previewAs));
    } catch {
      // Storage blocked: the back link falls back to the unfiltered list.
    }
  }, [previewAs, query]);

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
      const params = withPreview(serializeQuery({ ...query, ...patch }), previewAs);
      router.replace(params ? `${pathname}?${params}` : pathname, { scroll: false });
    },
    [pathname, previewAs, query, router],
  );

  const setPreview = (email: string | null) => {
    const params = withPreview(serializeQuery(DEFAULT_QUERY), email);
    router.replace(params ? `${pathname}?${params}` : pathname, { scroll: false });
  };
  const linkQuery = previewAs ? `?as=${encodeURIComponent(previewAs)}` : "";

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
        <p className="mt-2 font-mono text-xs text-fail">{load.message}</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
          className="mt-6 h-8 rounded-md border border-rule-2 px-3 text-ink hover:bg-paper-3"
        >
          Try again
        </button>
        <p className="mt-6 text-sm text-muted">
          Signed in but still failing?{" "}
          <Link href="/diagnostics" className="text-accent hover:underline">
            Run diagnostics
          </Link>
        </p>
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
          <p className="mt-0.5 text-xs text-muted">
            Every cloud flow in the environment, worst first.
          </p>
        </div>
        {/* Client-only: an email in server HTML gets rewritten by proxies like
            Cloudflare's email obfuscation, which breaks hydration. */}
        {load.status === "ready" && (canPreview || previewAs) && (
          <ViewAs previewing={previewAs} onChange={setPreview} />
        )}
      </div>

      {load.status === "ready" ? (
        <SummaryStrip summary={summary} query={query} onApply={update} />
      ) : (
        <div aria-hidden className="h-[74px] border-y border-rule bg-paper-2" />
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
            className="h-8 w-full rounded-md border border-rule bg-paper-2 pr-8 pl-3 text-sm text-ink placeholder:text-muted hover:border-rule-2"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-rule px-1.5 font-mono text-[10px] text-muted sm:block">
            /
          </kbd>
        </label>

        <button
          type="button"
          onClick={() => drawer.current?.showModal()}
          className="h-8 rounded-md border border-rule px-3 whitespace-nowrap text-ink-2 hover:border-rule-2 lg:hidden"
        >
          Filters
          {filterCount > 0 && <span className="ml-1.5 font-mono text-accent">{filterCount}</span>}
        </button>

        <div className="hidden lg:block">{filters("inline")}</div>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="tabular font-mono text-xs whitespace-nowrap text-muted"
            aria-live="polite"
          >
            {visible.length} of {flows.length}
          </span>
          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            className="h-8 rounded-md border border-rule px-3 whitespace-nowrap text-ink-2 hover:border-rule-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {load.status === "loading" ? (
        <p className="px-4 py-12 font-mono text-xs text-muted sm:px-6">Loading flows…</p>
      ) : visible.length === 0 ? (
        <div className="border-t border-rule px-4 py-12 sm:px-6">
          <p className="text-ink">No flows match these filters.</p>
          <button
            type="button"
            onClick={() =>
              update({ ...DEFAULT_QUERY, sort: query.sort, descending: query.descending })
            }
            className="mt-3 text-accent underline-offset-4 hover:underline"
          >
            Clear filters and search
          </button>
        </div>
      ) : (
        <>
          <div className="hidden border-t border-rule md:block">
            <FlowTable
              flows={visible}
              query={query}
              now={load.generatedAt}
              onSort={sortBy}
              linkQuery={linkQuery}
            />
          </div>
          <div className="border-t border-rule md:hidden">
            <FlowCards flows={visible} now={load.generatedAt} linkQuery={linkQuery} />
          </div>
        </>
      )}

      <dialog
        ref={drawer}
        onClick={(event) => event.target === drawer.current && drawer.current.close()}
        className="mt-auto mb-0 w-full max-w-none rounded-t-xl border border-rule bg-paper p-0 text-ink-2 backdrop:bg-scrim"
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <h2 className="font-medium">Filters</h2>
          <button
            type="button"
            onClick={() => drawer.current?.close()}
            className="h-8 px-2 text-accent"
          >
            Done
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto px-4 py-4">{filters("stacked")}</div>
      </dialog>
    </div>
  );
}

/** Filter params plus the preview account, which is not a filter. */
function withPreview(params: URLSearchParams, previewAs: string | null): string {
  if (previewAs) params.set("as", previewAs);
  return params.toString();
}
