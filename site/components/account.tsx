"use client";

// 账号相关的小组件：顶栏的登录 / 头像、创建进度仓的卡片、题目页的状态切换
import { Button, Card, Switch } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { useState } from "react";

import { PixelBullet, PixelIcon, PixelTitle } from "@/components/pixel";
import { useProgress } from "@/lib/progress";
import type { Status } from "@/lib/types";
import { STATUS_ORDER } from "@/lib/types";

/** 顶栏右侧：没登录时是「登录」按钮，登录后是像素头像 + 用户名 + 退出 */
export function AccountButton() {
  const { loading, session, logout, loginHref } = useProgress();
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
  return (
    <span className="flex items-center gap-1">
      <a
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-muted no-underline transition-colors hover:text-foreground"
        href={session.repo?.url ?? `https://github.com/${u.login}`}
        rel="noopener noreferrer"
        target="_blank"
        title="打开我的进度仓"
      >
        {/* 用 16px 的头像放大显示，再关掉平滑，就是像素头像 */}
        <img alt="" className="size-6 rounded-[4px]" height={24} src={`${u.avatar}${u.avatar.includes("?") ? "&" : "?"}s=16`} style={{ imageRendering: "pixelated" }} width={24} />
        <span className="font-pixel hidden text-[11px] tracking-wider sm:inline">{u.login}</span>
      </a>
      <Button isIconOnly aria-label="退出登录" size="sm" variant="ghost" onPress={logout}>
        <PixelIcon cell={2} name="exit" />
      </Button>
    </span>
  );
}

function Step({ n, title, active, done, children }: { n: number; title: string; active: boolean; done: boolean; children?: React.ReactNode }) {
  return (
    <div className={`flex gap-3 ${active ? "" : "opacity-50"}`}>
      <span className={`font-pixel mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-[11px] ${done ? "bg-success text-background" : active ? "bg-accent text-background" : "bg-foreground/10"}`}>{done ? "✓" : n}</span>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {active && children}
      </div>
    </div>
  );
}

/**
 * 登录了但还不能读写进度仓时的两步引导：
 * ① 在 GitHub 上用模板创建 hot100-progress；② 把 GitHub App 装到这个仓库上（只选这一个仓库）。
 */
export function SetupCard() {
  const { session, ready, loading, star, refresh, installHref } = useProgress();
  const [wantStar, setWantStar] = useState(true);
  const [checking, setChecking] = useState(false);
  if (loading || ready || !session?.user || !session.repo) return null;
  const { repo } = session;
  const step = !repo.exists ? 1 : 2;
  const maybeStar = () => {
    if (wantStar && !session.starred) star();
  };
  const recheck = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };
  return (
    <Card className="reveal gap-5 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <PixelBullet />
        <span className="text-base font-semibold">两步开通你自己的进度</span>
      </div>
      <p className="text-sm leading-6 text-muted">
        进度和题解存在你账号下的公开仓库 <span className="font-mono text-foreground">{repo.name}</span> 里。网站只申请这一个仓库的读写权限，不碰你的其他仓库。
      </p>
      <div className="flex flex-col gap-4">
        <Step active={step === 1} done={step > 1} n={1} title="用模板创建进度仓">
          <p className="text-xs leading-5 text-muted">
            在 GitHub 的新建页面里，仓库名填 <span className="font-mono">{session.repoName}</span>，选 Public，然后点 Create repository。
          </p>
          <div className="flex flex-wrap gap-2">
            <a className="no-underline" href={session.createUrl} rel="noopener noreferrer" target="_blank" onClick={maybeStar}>
              <Button size="sm">在 GitHub 上创建</Button>
            </a>
            <Button isPending={checking} size="sm" variant="outline" onPress={recheck}>
              建好了
            </Button>
          </div>
        </Step>
        <Step active={step === 2} done={false} n={2} title="把 GitHub App 装到这个仓库上">
          <p className="text-xs leading-5 text-muted">
            安装时选 Only select repositories，只勾 <span className="font-mono">{session.repoName}</span>。装完会自动回到这里。
          </p>
          <div className="flex flex-wrap gap-2">
            {repo.manageUrl ? (
              <>
                <a className="no-underline" href={repo.manageUrl} rel="noopener noreferrer" target="_blank" onClick={maybeStar}>
                  <Button size="sm">把仓库加进已装的 App</Button>
                </a>
                <Button isPending={checking} size="sm" variant="outline" onPress={recheck}>
                  加好了
                </Button>
              </>
            ) : (
              <a className="no-underline" href={installHref()} onClick={maybeStar}>
                <Button size="sm">安装 GitHub App</Button>
              </a>
            )}
          </div>
        </Step>
      </div>
      {!session.starred && (
        <Switch isSelected={wantStar} onChange={setWantStar}>
          <Switch.Content className="text-sm">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            顺手给模板仓库 {session.template} 点个 Star
          </Switch.Content>
        </Switch>
      )}
    </Card>
  );
}

/** 没登录时首页上的一句提示 */
export function LoginHint() {
  const { loading, session, loginHref } = useProgress();
  if (loading || !session?.configured || session.user) return null;
  return (
    <Card className="reveal flex-row flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
      <span className="flex items-center gap-3 text-sm text-muted">
        <PixelBullet />
        现在看到的是 0 进度。用 GitHub 登录后，进度和你自己的题解会存进你账号下的进度仓。
      </span>
      <a className="no-underline" href={loginHref()}>
        <Button size="sm">
          <PixelIcon cell={1.75} name="cat" />
          GitHub 登录
        </Button>
      </a>
    </Card>
  );
}

/** 题目页：切换这道题的状态，直接提交到进度仓 */
export function StatusPicker({ id }: { id: number }) {
  const { session, ready, statusOf, setStatus, saving, error } = useProgress();
  if (!ready || !session?.repo) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segment aria-label="这道题的状态" selectedKey={statusOf(id)} size="sm" onSelectionChange={(k) => setStatus(id, String(k) as Status)}>
        {STATUS_ORDER.map((s) => (
          <Segment.Item key={s} id={s}>
            {s}
          </Segment.Item>
        ))}
      </Segment>
      <span className="text-xs text-muted">
        {saving === id ? "正在提交到进度仓…" : error ? <span className="text-danger">{error}</span> : <>存在 {session.repo.name}</>}
      </span>
    </div>
  );
}
