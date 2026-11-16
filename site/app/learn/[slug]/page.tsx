import { TopicView } from "@/components/topic-view";
import { TOPIC_SLUGS } from "@/lib/topic-slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOPIC_SLUGS.map((slug) => ({ slug }));
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TopicView key={slug} slug={slug} />;
}
