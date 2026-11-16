import type { Metadata } from "next";

import { TopicList } from "@/components/topic-list";

export const metadata: Metadata = { title: "数据结构与算法基础" };

export default function LearnPage() {
  return <TopicList />;
}
