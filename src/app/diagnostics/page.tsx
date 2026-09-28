import { connection } from "next/server";
import { DiagnosticsView } from "@/components/diagnostics/DiagnosticsView";

export default async function DiagnosticsPage() {
  await connection();
  return (
    <main>
      <DiagnosticsView />
    </main>
  );
}
