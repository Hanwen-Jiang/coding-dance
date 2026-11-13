import { ProblemView } from "@/components/problem-view";
import { IDS } from "@/lib/ids";

export const dynamicParams = false;

export function generateStaticParams() {
  return IDS.map((id) => ({ id: String(id) }));
}

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProblemView key={id} id={Number(id)} />;
}
