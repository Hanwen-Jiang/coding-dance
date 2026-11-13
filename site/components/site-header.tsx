"use client";

import { Button } from "@heroui/react";
import NextLink from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/icons";
import { PixelLogo } from "@/components/pixel";

function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div aria-hidden className="size-9" />;
  const dark = resolvedTheme === "dark";
  return (
    <Button isIconOnly aria-label={dark ? "切换到浅色" : "切换到深色"} size="sm" variant="ghost" onPress={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-separator bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <NextLink className="group flex items-center gap-3 no-underline" href="/">
          <PixelLogo className="h-6 w-auto" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">热题 100 · 题解手册</span>
            <span className="font-pixel hidden text-[10px] tracking-wider text-muted sm:block">~/leetcode/top100</span>
          </span>
        </NextLink>
        <div className="flex items-center gap-1">
          <a
            className="hidden rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground sm:block"
            href="https://leetcode.cn/studyplan/top-100-liked/"
            rel="noopener noreferrer"
            target="_blank"
          >
            力扣题单
          </a>
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
