"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setTokenSource } from "@/lib/api/client";
import { Auth } from "@/lib/auth/msal";
import type { PublicConfig } from "@/lib/config";
import { buttonClass } from "@/components/ui/Dialog";

interface AuthState {
  mode: "demo" | "live";
  user: { name: string; email: string } | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({ mode: "demo", user: null, signOut: () => {} });

export const useAuth = () => useContext(AuthContext);

type Status =
  | { kind: "starting" }
  | { kind: "signed-out" }
  | { kind: "signed-in"; name: string; email: string }
  | { kind: "error"; message: string };

/** Demo: renders children as is. Live: nothing renders until MSAL has a user. */
export function AuthProvider({
  config,
  children,
}: {
  config: PublicConfig;
  children: React.ReactNode;
}) {
  const auth = useMemo(
    () =>
      config.mode === "live" && config.tenantId && config.clientId && config.appUrl
        ? new Auth({ tenantId: config.tenantId, clientId: config.clientId, appUrl: config.appUrl })
        : null,
    [config],
  );
  const [status, setStatus] = useState<Status>({ kind: "starting" });

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    auth
      .init()
      .then((account) => {
        if (cancelled) return;
        if (!account) return setStatus({ kind: "signed-out" });
        setTokenSource(() => auth.tokens());
        setStatus({
          kind: "signed-in",
          name: account.name ?? account.username,
          email: account.username.toLowerCase(),
        });
      })
      .catch((error: Error) => !cancelled && setStatus({ kind: "error", message: error.message }));
    return () => {
      cancelled = true;
      setTokenSource(null);
    };
  }, [auth]);

  if (!auth) {
    return (
      <AuthContext.Provider value={{ mode: "demo", user: null, signOut: () => {} }}>
        {children}
      </AuthContext.Provider>
    );
  }

  if (status.kind !== "signed-in") {
    return <SignInScreen status={status} onSignIn={() => auth.signIn()} />;
  }

  return (
    <AuthContext.Provider
      value={{
        mode: "live",
        user: { name: status.name, email: status.email },
        signOut: () => void auth.signOut(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function SignInScreen({ status, onSignIn }: { status: Status; onSignIn: () => void }) {
  return (
    <main className="mx-auto grid min-h-[70dvh] max-w-md content-center gap-4 px-4">
      <p className="font-mono text-sm">
        <span className="text-accent">365</span> <span className="text-ink">Flow Watcher</span>
      </p>
      {status.kind === "starting" ? (
        <p className="font-mono text-xs text-muted">Checking your session…</p>
      ) : (
        <>
          <h1 className="text-xl font-medium">Sign in to see your tenant&apos;s flows</h1>
          <p className="text-sm text-muted">
            You sign in with your Microsoft work account. The app reads flows with your own
            permissions and never stores your password or tokens on the server.
          </p>
          {status.kind === "error" && (
            <p className="font-mono text-xs text-fail">{status.message}</p>
          )}
          <div>
            <button type="button" onClick={onSignIn} className={buttonClass.primary}>
              Sign in with Microsoft
            </button>
          </div>
        </>
      )}
    </main>
  );
}
