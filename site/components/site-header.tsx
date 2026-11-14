"use client";

import { Button } from "@heroui/react";
import NextLink from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { AccountButton } from "@/components/account";
import { PixelIcon, PixelLogo, PixelTitle } from "@/components/pixel";

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
  return (
    <header className="sticky top-0 z-40 border-b border-separator bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <NextLink aria-label="Hot 100" className="group flex items-center gap-3 no-underline" href="/">
          <PixelLogo className="h-6 w-auto" />
          <span className="flex flex-col gap-1 leading-none">
            <PixelTitle cell={1.5} px={12} text="Hot 100" weight={700} />
            <span className="font-pixel hidden text-[10px] tracking-wider text-muted sm:block">~/leetcode/top100</span>
          </span>
        </NextLink>
        <div className="flex items-center gap-1">
          <a
            className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted no-underline transition-colors hover:text-foreground sm:inline-flex"
            href="https://leetcode.cn/studyplan/top-100-liked/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <PixelTitle cell={1.5} px={12} text="力扣题单" weight={500} />
            <PixelIcon cell={1.5} name="arrow" />
          </a>
          <ThemeSwitch />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}
