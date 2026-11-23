// 开通页（/welcome/，components/onboarding.tsx）的地址。登录回调里也有一份（functions/_lib/sso.ts 的 SETUP_PATH），两边要一样
export const SETUP_PATH = "/welcome/";

/** 去开通页的地址；开通完回到 back（默认当前页面） */
export function setupHref(back?: string): string {
  const b = back ?? (typeof window === "undefined" ? "/" : location.pathname + location.search);
  return b === "/" || b.startsWith(SETUP_PATH) ? SETUP_PATH : `${SETUP_PATH}?return=${encodeURIComponent(b)}`;
}
