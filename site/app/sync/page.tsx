import type { Metadata } from "next";

import { SyncGuide } from "@/components/sync-guide";

export const metadata: Metadata = { title: "从力扣同步" };

export default function SyncPage() {
  return <SyncGuide />;
}
