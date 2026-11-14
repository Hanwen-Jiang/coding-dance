import type { Metadata } from "next";

import { SyncApp } from "@/components/sync-app";

export const metadata: Metadata = { title: "从力扣同步" };

export default function SyncPage() {
  return <SyncApp />;
}
