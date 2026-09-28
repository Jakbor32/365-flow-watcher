import { connection } from "next/server";
import { Suspense } from "react";
import { FlowInventory } from "@/components/flows/FlowInventory";
import { ConfigError, getConfig } from "@/lib/config";

export default async function FlowsPage() {
  await connection();

  try {
    getConfig();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-lg font-medium">365 Flow Watcher is not configured</h1>
        <ul className="mt-4 list-disc space-y-1 pl-5 font-mono text-xs">
          {error.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
        <p className="mt-6">
          Every variable is explained in <code className="font-mono">docs/CONFIGURATION.md</code>.
        </p>
      </main>
    );
  }

  return (
    <main>
      <Suspense>
        <FlowInventory />
      </Suspense>
    </main>
  );
}
