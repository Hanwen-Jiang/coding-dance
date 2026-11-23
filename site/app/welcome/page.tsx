import type { Metadata } from "next";

import { Onboarding } from "@/components/onboarding";

export const metadata: Metadata = { title: "开通进度仓" };

// 登录、授权之后先到这里建进度仓（选私有 / 公开），建好再回原来的页面。见 components/onboarding.tsx
export default function WelcomePage() {
  return <Onboarding />;
}
