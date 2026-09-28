"use client";

import { useAuth } from "@/components/auth/AuthProvider";

export function UserMenu() {
  const { mode, user, signOut } = useAuth();

  if (mode === "demo") {
    return (
      <span className="hidden items-center gap-2 font-mono text-xs text-muted md:flex">
        <span className="whitespace-nowrap">contoso.com</span>
        <span className="text-rule-2">/</span>
        <span className="whitespace-nowrap">demo.admin</span>
      </span>
    );
  }
  if (!user) return null;

  return (
    <span className="flex items-center gap-3">
      <span
        className="hidden max-w-48 truncate font-mono text-xs text-muted md:inline"
        title={user.email}
      >
        {user.email}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="text-xs whitespace-nowrap text-muted hover:text-ink"
      >
        Sign out
      </button>
    </span>
  );
}
