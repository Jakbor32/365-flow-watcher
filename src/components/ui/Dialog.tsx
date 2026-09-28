"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Native <dialog>: focus trap, Esc and backdrop close come for free. */
export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-rule-2 bg-paper p-0 text-ink-2 backdrop:bg-scrim"
    >
      <div className="border-b border-rule px-5 py-3">
        <h2 id="dialog-title" className="font-medium">
          {title}
        </h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}

export const buttonClass = {
  primary:
    "h-8 rounded-md bg-accent px-3 font-medium whitespace-nowrap text-accent-ink hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "h-8 rounded-md bg-fail px-3 font-medium whitespace-nowrap text-paper hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "h-8 rounded-md border border-rule-2 px-3 whitespace-nowrap text-ink-2 hover:bg-paper-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
  quiet: "h-8 px-2 whitespace-nowrap text-muted hover:text-ink disabled:opacity-50",
};
