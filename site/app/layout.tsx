import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";

import { inter, jetbrainsMono, silkscreen } from "./fonts";
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
    // 字体变量要定义在 <html> 上：globals.css 的 --font-sans / --font-mono 也定义在 :root，引用它们
    <html suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} ${silkscreen.variable}`} lang="zh-CN">
      <head>
        {/* 题目页的练习区默认收起（右边一个像素把手，见 practice/workbench.tsx）；用户展开过、或者拖过宽度：首屏前就标上，页面直接按上次的样子画，不会先按默认画再跳 */}
        <script dangerouslySetInnerHTML={{ __html: `var h=document.documentElement;h.dataset.practice="closed";try{if(localStorage.getItem("hot100:practice:dock")==="open")h.dataset.practice="open";var w=Number(localStorage.getItem("hot100:practice:dock-size"));if(w>=0.15&&w<=0.8)h.style.setProperty("--practice-dock",String(w))}catch(e){}` }} />
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
