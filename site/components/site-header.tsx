"use client";

import { Button } from "@heroui/react";
import NextLink from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { PixelIcon, PixelLogo, PixelTitle } from "@/components/pixel";

function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div aria-hidden className="size-9" />;
  const dark = resolvedTheme === "dark";
  return (
    <Button isIconOnly aria-label={dark ? "切换到浅色" : "切换到深色"} size="sm" variant="ghost" onPress={() => setTheme(dark ? "light" : "dark")}>
      <PixelIcon cell={2} name={dark ? "sun" : "moon"} />
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
        </div>
      </div>
    </header>
  );
}
