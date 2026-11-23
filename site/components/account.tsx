"use client";

// 账号相关的小组件：顶栏的登录 / 账号菜单、首页的登录提示、题目页的状态切换。开通进度仓在开通页（components/onboarding.tsx）
import { Button, Card, Dropdown, Label, type Selection } from "@heroui/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

import { ChevronDown, ExternalIcon } from "@/components/icons";
import { PixelIcon, PixelTitle, StatusPixel } from "@/components/pixel";
import { useProgress } from "@/lib/progress";
import { setupHref } from "@/lib/setup";
import type { Status } from "@/lib/types";
import { STATUS_ORDER } from "@/lib/types";

/** 16px 的头像放大显示，再关掉平滑，就是像素头像 */
export function PixelAvatar({ src, size = 24 }: { src: string; size?: number }) {
  return <img alt="" className="rounded-[4px]" height={size} src={`${src}${src.includes("?") ? "&" : "?"}s=16`} style={{ imageRendering: "pixelated", width: size, height: size }} width={size} />;
}

/** 顶栏右侧：没登录时是「登录」按钮，登录后是头像，点开是账号菜单 */
export function AccountButton() {
  const { loading, session, logout, loginHref, ready } = useProgress();
  const router = useRouter();
  if (loading) return <span aria-hidden className="h-8 w-16" />;
  if (!session?.configured) return null;
  if (!session.user) {
    return (
      <a className="no-underline" href={loginHref()}>
        <Button size="sm" variant="outline">
          <PixelIcon cell={1.75} name="cat" />
          <PixelTitle cell={1.5} px={12} text="登录" weight={600} />
        </Button>
      </a>
    );
  }
  const u = session.user;
  const founder = !!session.member?.founder;
  const repoUrl = session.repo?.url ?? `https://github.com/${u.login}`;
  const act = (key: React.Key) => {
    if (key === "repo") window.open(repoUrl, "_blank", "noopener");
    else if (key === "sync") router.push("/sync/");
    else if (key === "setup") router.push(setupHref());
    else if (key === "logout") logout();
  };
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`账号 ${u.login}${founder ? "（首批用户）" : ""}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent">
        <span className="relative" title={founder ? "首批用户 · 永久专业版" : undefined}>
          {/* 首批用户（代码里叫 founder）：头像一圈金边，头顶一顶像素皇冠 */}
          <span className={clsx("block rounded-[6px]", founder && "ring-2 ring-warning ring-offset-1 ring-offset-background")}><PixelAvatar src={u.avatar} /></span>
          {founder && <span aria-hidden className="founder-crown absolute -top-3 left-1/2 -translate-x-1/2 text-warning drop-shadow-[0_1px_0_var(--background)]"><PixelIcon cell={1.75} name="crown" /></span>}
          {/* 进度仓能不能用：右下角一个小点 */}
          <span aria-hidden className={clsx("absolute -right-0.5 -bottom-0.5 size-2 rounded-[2px] ring-2 ring-background", ready ? "bg-success" : "bg-warning")} />
        </span>
        <span className={clsx("font-pixel hidden text-[11px] tracking-wider sm:inline", founder && "font-semibold text-warning")}>{u.login}</span>
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-60" placement="bottom end">
        <div className="flex items-center gap-3 border-b border-separator px-3 py-3">
          <span className={clsx("rounded-[6px]", founder && "ring-2 ring-warning ring-offset-1 ring-offset-background")}><PixelAvatar size={32} src={u.avatar} /></span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={clsx("truncate text-sm font-semibold", founder && "text-warning")}>{u.login}</span>
            {founder && (
              <span className="inline-flex items-center gap-1 self-start rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                <PixelIcon cell={1} name="crown" />首批用户 · 永久专业版
              </span>
            )}
            <span className={clsx("text-xs", ready ? "text-success" : "text-warning")}>{ready ? "进度仓已连接" : "进度仓还没开通"}</span>
            {founder && session.member?.since && <span className="text-[11px] text-muted">{session.member.since} 加入</span>}
          </div>
        </div>
        <Dropdown.Menu aria-label="账号" onAction={act}>
          {ready ? (
            <Dropdown.Item id="repo" textValue="打开我的进度仓">
              <span className="flex w-full items-center justify-between gap-3">打开我的进度仓<ExternalIcon /></span>
            </Dropdown.Item>
          ) : (
            <Dropdown.Item id="setup" textValue="去开通进度仓">去开通进度仓</Dropdown.Item>
          )}
          <Dropdown.Item id="sync" textValue="从力扣同步">从力扣同步提交记录</Dropdown.Item>
          <Dropdown.Item id="logout" textValue="退出登录">
            <span className="text-danger">退出登录</span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** 「用 GitHub 登录」按钮。顺手 Star 和关注共创者都放在登录之后的开通页里，这里只管登录 */
export function LoginButton({ size, className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const { loginHref } = useProgress();
  // 在 Button 自己的 onPress 里跳转：Button 不让点击冒泡，包一层 <a onClick> 是收不到的
  return (
    <Button className={className} size={size} onPress={() => { window.location.href = loginHref(); }}>
      <PixelIcon cell={1.75} name="cat" />
      用 GitHub 登录
    </Button>
  );
}

/** 没登录时首页上的登录提示：只有一句说明和登录按钮 */
export function LoginHint() {
  const { loading, session } = useProgress();
  if (loading || !session?.configured || session.user) return null;
  return (
    <Card className="reveal p-5 sm:px-6">
      {/* 说明至少要 18rem 宽：放不下按钮时按钮换到下一行（手机上占满一行），不再把说明挤成一两个字一行 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 grow basis-72 items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground/[0.06]"><PixelIcon cell={2.5} name="cat" /></span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-semibold">登录后，这里显示你自己的进度</span>
            <span className="text-sm leading-6 text-muted">
              进度和题解存在你自己 GitHub 账号下的 <span className="font-mono">{session.repoName}</span> 仓库里，可以设成私有。
            </span>
          </div>
        </div>
        <LoginButton className="w-full sm:w-auto" />
      </div>
    </Card>
  );
}

/**
 * 题目页标题下面那一行里的「这道题的状态」：平时只占一个小标签，点开是一个单选菜单，选了直接提交到进度仓。
 * 没登录或进度仓还没开通时只显示状态，不能改。
 */
export function StatusPicker({ id }: { id: number }) {
  const { session, ready, statusOf, setStatus, saving, error } = useProgress();
  const current = statusOf(id);
  if (!ready || !session?.repo) return <StatusPixel status={current} />;
  const busy = saving === id;
  const pick = (keys: Selection) => {
    const next = keys === "all" ? null : ([...keys][0] as Status | undefined);
    if (next && next !== current) setStatus(id, next);
  };
  return (
    <span className="inline-flex items-center gap-2">
      <Dropdown>
        <Dropdown.Trigger
          aria-label={`这道题的状态：${current}，点击修改`}
          className="inline-flex h-6 items-center gap-1 rounded-full border border-border px-2.5 outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
        >
          <StatusPixel status={current} />
          <ChevronDown aria-hidden className="text-muted" height={12} width={12} />
        </Dropdown.Trigger>
        <Dropdown.Popover className="min-w-48" placement="bottom start">
          <Dropdown.Menu aria-label="这道题的状态" disallowEmptySelection selectedKeys={new Set([current])} selectionMode="single" onSelectionChange={pick}>
            {STATUS_ORDER.map((s) => (
              <Dropdown.Item key={s} id={s} textValue={s}>
                <Dropdown.ItemIndicator />
                <Label><StatusPixel className="text-sm text-foreground" status={s} /></Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
          <p className="border-t border-separator px-3 py-2 text-[11px] leading-4 text-muted">
            保存在 <span className="font-mono">{session.repo.name}</span>
          </p>
        </Dropdown.Popover>
      </Dropdown>
      {busy ? <span className="text-xs text-muted">保存中…</span> : error ? <span className="text-xs text-danger" title={error}>没保存上</span> : null}
    </span>
  );
}
