"use client";

import { Button } from "@heroui/react";
import clsx from "clsx";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { AccountButton } from "@/components/account";
import { LangPicker } from "@/components/lang-picker";
import { PixelIcon, PixelLogo, PixelTitle } from "@/components/pixel";
import { useProgress } from "@/lib/progress";

/** 旧的按钮只会存「浅色 / 深色」，存了就再也不跟随系统。换成新按钮后把旧的选择清掉一次，回到默认的跟随系统 */
const THEME_RESET_KEY = "hot100:theme-follows-system";

/**
 * 默认跟随系统。点一下切到另一种颜色并固定下来；切到的颜色正好和系统一样时，就改回「跟随系统」，
 * 所以多点一下总能回到跟随系统，之后系统换深浅色也会跟着换。
 */
function ThemeSwitch() {
  const { theme, resolvedTheme, systemTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      if (!localStorage.getItem(THEME_RESET_KEY)) {
        localStorage.setItem(THEME_RESET_KEY, "1");
        setTheme("system");
      }
    } catch { /* 存不了就照旧 */ }
  }, [setTheme]);
  if (!mounted) return <div aria-hidden className="size-9" />;
  const dark = resolvedTheme === "dark";
  const next = dark ? "light" : "dark";
  const follows = theme === "system";
  const label = `${follows ? "跟随系统" : "已固定"}：${dark ? "深色" : "浅色"}。点一下切到${next === "dark" ? "深色" : "浅色"}${next === systemTheme ? "（跟随系统）" : ""}`;
  return (
    <Button isIconOnly aria-label={label} size="sm" variant="ghost" onPress={() => setTheme(next === systemTheme ? "system" : next)}>
      <span title={label}><PixelIcon cell={2} name={dark ? "sun" : "moon"} /></span>
    </Button>
  );
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const { ready } = useProgress();
  const inLearn = pathname.startsWith("/learn");
  const inSync = pathname.startsWith("/sync");

  return (
    <header className="sticky top-0 z-40 border-b border-separator bg-background/75 backdrop-blur-xl">
      <div className="site-header-inner mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <NextLink aria-label="Hot 100" className="group flex items-center gap-3 no-underline" href="/">
          <PixelLogo className="h-6 w-auto" />
          <span className="flex flex-col gap-1 leading-none">
            <PixelTitle cell={1.5} px={12} text="Hot 100" weight={700} />
            <span className="font-pixel hidden text-[10px] tracking-wider text-muted sm:block">~/leetcode/top100</span>
          </span>
        </NextLink>
        <div className="flex items-center gap-1">
          <NextLink
            aria-current={inLearn ? "page" : undefined}
            aria-label="数据结构与算法基础"
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 no-underline transition-colors sm:px-3",
              inLearn ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground",
            )}
            href="/learn/"
          >
            <PixelTitle cell={1.5} px={12} text="基础" weight={500} />
          </NextLink>
          {ready && (
            <NextLink
              aria-current={inSync ? "page" : undefined}
              aria-label="从力扣同步提交记录"
              className={clsx(
                "hidden items-center gap-1.5 rounded-lg px-2 py-1.5 no-underline transition-colors sm:inline-flex sm:px-2.5",
                inSync ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground",
              )}
              href="/sync/"
            >
              <PixelTitle cell={1.5} px={12} text="同步" weight={500} />
            </NextLink>
          )}
          <LangPicker />
          <ThemeSwitch />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}
