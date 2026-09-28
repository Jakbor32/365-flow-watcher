import { connection } from "next/server";
import { ConfigError, getConfig } from "@/lib/config";
import { DemoDataSource, demoNow } from "@/lib/data/demo-source";

// Placeholder until module 2 builds the real dashboard.
export default async function Home() {
  await connection();

  let mode: string;
  try {
    mode = getConfig().mode;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return (
      <main className="mx-auto max-w-2xl p-6 font-mono text-sm">
        <h1 className="mb-4 text-lg font-semibold">365 Flow Watcher is not configured</h1>
        <ul className="list-disc space-y-1 pl-5">
          {error.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
        <p className="mt-4">See docs/CONFIGURATION.md.</p>
      </main>
    );
  }

  const flows = mode === "demo" ? await new DemoDataSource(demoNow()).listFlows() : [];

  return (
    <main className="mx-auto max-w-2xl p-6 font-mono text-sm">
      <h1 className="text-lg font-semibold">365 Flow Watcher</h1>
      <p>
        mode: {mode}, flows: {flows.length}, orphaned:{" "}
        {flows.filter((flow) => flow.orphaned).length}
      </p>
    </main>
  );
}
