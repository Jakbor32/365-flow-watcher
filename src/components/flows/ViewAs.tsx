"use client";

import { useState } from "react";
import { Dialog, buttonClass } from "@/components/ui/Dialog";
import { PersonPicker } from "@/components/detail/PersonPicker";

interface Props {
  previewing: string | null;
  onChange: (email: string | null) => void;
}

/** Preview managers only: show one person's flows instead of the usual scope. */
export function ViewAs({ previewing, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  if (previewing) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-accent/40 bg-accent-wash px-3 py-1.5 text-sm">
        <span>
          Viewing flows owned by <span className="font-mono text-ink">{previewing}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-accent hover:underline"
        >
          Stop
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass.secondary}>
        View as…
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="View someone's flows">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(false);
            onChange(email.trim().toLowerCase());
          }}
        >
          <p className="text-sm text-muted">
            Read-only. Useful when someone asks &quot;why did my flow stop?&quot; or before they
            leave the company.
          </p>
          <PersonPicker value={email} onChange={setEmail} exclude={new Set()} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={buttonClass.quiet}>
              Cancel
            </button>
            <button type="submit" disabled={!email.includes("@")} className={buttonClass.primary}>
              Show their flows
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
