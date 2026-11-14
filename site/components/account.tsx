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

/** 登录了但还没有进度仓：用模板创建一个 */
export function SetupCard() {
  const { session, setup } = useProgress();
  const [star, setStar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!session?.user || !session.repo || session.repo.exists) return null;
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      await setup(star);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="reveal gap-4 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <PixelBullet />
        <span className="text-base font-semibold">还差一步：创建你的进度仓</span>
      </div>
      <p className="text-sm leading-6 text-muted">
        会用模板在你的账号下创建一个公开仓库 <span className="font-mono text-foreground">{session.repo.name}</span>，从 0 进度开始。以后每道题的状态和你写的题解都存在那里，文件规则在仓库的 README 里。
      </p>
      <Switch isSelected={star} onChange={setStar}>
        <Switch.Content className="text-sm">
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          顺手给模板仓库 {session.template} 点个 Star
        </Switch.Content>
      </Switch>
      <div className="flex flex-wrap items-center gap-3">
        <Button isPending={busy} onPress={run}>
          {busy ? "正在创建…" : "创建我的进度仓"}
        </Button>
        {err && <span className="text-sm text-danger">{err}</span>}
      </div>
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
  const { session, progress, statusOf, setStatus, saving, error } = useProgress();
  if (!session?.user || !session.repo?.exists || !progress) return null;
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
