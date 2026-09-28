"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api/client";
import type { Person } from "@/lib/domain/types";

interface Props {
  value: string;
  onChange: (email: string) => void;
  /** Shown before the user types, e.g. people who can already view the flow. */
  suggestions?: Person[];
  exclude: Set<string>;
}

/** Email field with directory suggestions. Typing any valid email also works. */
export function PersonPicker({ value, onChange, suggestions = [], exclude }: Props) {
  const [results, setResults] = useState<Person[]>([]);
  const listId = useId();

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2 || query.includes("@")) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ people: Person[] }>(`/api/people?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((body) => setResults(body.people))
        .catch(() => setResults([]));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const typed = value.trim().length >= 2 && !value.includes("@");
  const options = (typed ? results : suggestions).filter((person) => !exclude.has(person.id));

  return (
    <div className="grid gap-2">
      <label htmlFor={listId} className="font-mono text-[11px] tracking-wide text-muted uppercase">
        Person
      </label>
      <input
        id={listId}
        type="text"
        inputMode="email"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Name or email"
        className="h-9 w-full rounded-md border border-rule bg-paper-2 px-3 text-ink placeholder:text-muted hover:border-rule-2"
      />
      {options.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-md border border-rule">
          {options.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onChange(person.email)}
                aria-pressed={value === person.email}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-paper-3 aria-pressed:bg-accent-wash"
              >
                <span className="text-ink">{person.displayName}</span>
                <span className="font-mono text-xs text-muted">{person.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
