import { connection } from "next/server";
import { InsightsView } from "@/components/insights/InsightsView";

export default async function InsightsPage() {
  await connection();
  return (
    <main>
      <InsightsView />
    </main>
  );
}
