import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";
import { OverlayScrollbar } from "@/components/overlay-scrollbar";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: "热题 100 · 题解手册", template: "%s · 热题 100 题解手册" },
  description: "力扣热题 100：原题、分层提示、简洁的 Python 题解、标准题解和我的历史题解。",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="zh-CN">
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
        {/* 像素字体用 block：短暂等待字体，而不是先显示后备字体再跳变 */}
        <link href="https://fonts.googleapis.com/css2?family=Silkscreen&display=block" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans text-foreground antialiased">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">{children}</main>
          <footer className="border-t border-separator bg-background/80 py-8 text-center text-xs text-muted backdrop-blur">
            <span className="font-pixel me-2 text-[11px] tracking-wider">EOF</span>
            题面来自力扣，版权归力扣所有 · 数据实时读取自刷题仓库
          </footer>
          <OverlayScrollbar />
        </Providers>
      </body>
    </html>
  );
}
