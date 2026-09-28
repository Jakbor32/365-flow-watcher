import { connection } from "next/server";
import { FlowDetail } from "@/components/detail/FlowDetail";

export default async function FlowPage(props: PageProps<"/flows/[id]">) {
  await connection();
  const { id } = await props.params;
  return (
    <main>
      <FlowDetail flowId={id} />
    </main>
  );
}
