"use client";

// 账号相关的小组件：顶栏的登录 / 账号菜单、首页的登录提示、开通进度仓的卡片、点 Star 的卡片、题目页的状态切换
import { Button, Card, Checkbox, Dropdown } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ExternalIcon } from "@/components/icons";
import { PixelBullet, PixelIcon, PixelTitle } from "@/components/pixel";
import { useProgress } from "@/lib/progress";
import type { StarResult, Status } from "@/lib/types";
import { STATUS_ORDER } from "@/lib/types";

/** 16px 的头像放大显示，再关掉平滑，就是像素头像 */
function PixelAvatar({ src, size = 24 }: { src: string; size?: number }) {
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
  const repoUrl = session.repo?.url ?? `https://github.com/${u.login}`;
  const act = (key: React.Key) => {
    if (key === "repo") window.open(repoUrl, "_blank", "noopener");
    else if (key === "sync") router.push("/sync/");
    else if (key === "home") router.push("/");
    else if (key === "logout") logout();
  };
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`账号 ${u.login}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent">
        <span className="relative">
          <PixelAvatar src={u.avatar} />
          {/* 进度仓能不能用：右下角一个小点 */}
          <span aria-hidden className={clsx("absolute -right-0.5 -bottom-0.5 size-2 rounded-[2px] ring-2 ring-background", ready ? "bg-success" : "bg-warning")} />
        </span>
        <span className="font-pixel hidden text-[11px] tracking-wider sm:inline">{u.login}</span>
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-56" placement="bottom end">
        <div className="flex items-center gap-3 border-b border-separator px-3 py-3">
          <PixelAvatar size={32} src={u.avatar} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{u.login}</span>
            <span className={clsx("text-xs", ready ? "text-success" : "text-warning")}>{ready ? "进度仓已连接" : "进度仓还没开通"}</span>
          </div>
        </div>
        <Dropdown.Menu aria-label="账号" onAction={act}>
          {ready ? (
            <Dropdown.Item id="repo" textValue="打开我的进度仓">
              <span className="flex w-full items-center justify-between gap-3">打开我的进度仓<ExternalIcon /></span>
            </Dropdown.Item>
          ) : (
            <Dropdown.Item id="home" textValue="去开通进度仓">去开通进度仓</Dropdown.Item>
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

/** 每个仓库一句话说明，让用户知道自己在给什么点 Star */
const STAR_INFO: Record<string, string> = {
  "Hanwen-Jiang/agent-runtime": "作者的多租户 Agent 运行核心",
  "Hanwen-Jiang/coding-agent": "建在 Agent Runtime 上的在线多租户 coding agent",
  "Hanwen-Jiang/leetcode": "这个网站，以及全部题解和动画的源码",
};

/** 还没 Star 的仓库和用户的勾选（默认全勾，可以逐个取消）。没登录时列出全部仓库，登录后再点 */
export function useStarChoice() {
  const { session, star } = useProgress();
  const pending = useMemo(() => (session?.stars ?? []).filter((s) => !s.starred).map((s) => s.repo), [session]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<StarResult[]>([]);
  const [busy, setBusy] = useState(false);
  const chosen = pending.filter((r) => !off.has(r));
  const toggle = (repo: string, on: boolean) => setOff((s) => { const n = new Set(s); if (on) n.delete(repo); else n.add(repo); return n; });
  const run = async () => {
    if (!chosen.length) return [];
    setBusy(true);
    const res = await star(chosen);
    setResults((old) => [...old.filter((o) => !res.some((r) => r.repo === o.repo)), ...res]);
    setBusy(false);
    return res;
  };
  return { all: session?.stars ?? [], pending, chosen, off, toggle, run, busy, results };
}
type StarChoice = ReturnType<typeof useStarChoice>;

/** 注册、登录时的「顺手 Star」：说明 + 仓库列表。login 时勾着的会在登录回来后点，注册时在点开通按钮时一起点 */
export function StarPicker({ c, when }: { c: StarChoice; when: "login" | "setup" }) {
  if (!c.all.length) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-separator pt-4">
      <span className="text-sm text-muted">
        {!c.pending.length
          ? "下面这些你都已经 Star 了，谢谢。"
          : when === "login"
            ? "觉得有用的话，顺手点个 Star：勾着的会在你登录后自动点上，不想点的取消勾选。"
            : "觉得有用的话，开通时顺手点个 Star：勾着的会在你点上面的按钮时一起点，不想点的取消勾选。"}
      </span>
      <StarList c={c} />
    </div>
  );
}

/** 仓库列表：没 Star 的带勾选框；接口没点上的，给一个去 GitHub 手动点的链接 */
function StarList({ c }: { c: StarChoice }) {
  return (
    <ul className="flex flex-col gap-2">
      {c.all.map(({ repo, starred }) => {
        const failed = c.results.find((r) => r.repo === repo && !r.starred);
        const link = (
          <a className="font-mono text-[13px] text-foreground no-underline hover:underline" href={`https://github.com/${repo}`} rel="noopener noreferrer" target="_blank">{repo}</a>
        );
        return (
          <li key={repo} className="flex items-start gap-3 rounded-xl border border-separator px-3 py-2.5">
            {starred ? (
              <span aria-label="已经 Star" className="mt-0.5 grid size-5 shrink-0 place-items-center text-warning"><PixelIcon cell={2} name="star" /></span>
            ) : (
              <Checkbox aria-label={`Star ${repo}`} className="mt-0.5" isSelected={!c.off.has(repo)} onChange={(on) => c.toggle(repo, on)}>
                <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
              </Checkbox>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-x-2">{link}{starred && <span className="text-xs text-success">已 Star，谢谢</span>}</span>
              {STAR_INFO[repo] && <span className="text-xs leading-5 text-muted">{STAR_INFO[repo]}</span>}
              {failed && (
                <span className="text-xs leading-5 text-warning">
                  没点上{failed.status ? `（GitHub 返回 ${failed.status}）` : ""}。
                  <a href={`https://github.com/${repo}`} rel="noopener noreferrer" target="_blank">去 GitHub 上手动点一下</a>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Step({ n, title, active, done, last, children }: { n: number; title: string; active: boolean; done: boolean; last?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={clsx("font-pixel grid size-6 shrink-0 place-items-center rounded-md text-[11px]", done ? "bg-success text-white" : active ? "bg-accent text-white" : "bg-foreground/10 text-muted")}>{done ? "✓" : n}</span>
        {!last && <span aria-hidden className={clsx("my-1 w-px flex-1", done ? "bg-success/40" : "bg-separator")} />}
      </div>
      <div className={clsx("flex min-w-0 flex-1 flex-col gap-2 pb-4", !active && !done && "opacity-50")}>
        <span className="text-sm font-semibold leading-6">{title}{done && <span className="ms-2 text-xs font-normal text-success">完成</span>}</span>
        {active && children}
      </div>
    </div>
  );
}

/**
 * 登录了但还不能读写进度仓时的两步引导：
 * ① 在 GitHub 上用模板创建 hot100-progress；② 把 GitHub App 装到这个仓库上（只选这一个仓库）。
 * 下面列出请用户顺手 Star 的仓库（默认勾着，可以取消），在用户点开通按钮时一起点。
 */
export function SetupCard() {
  const { session, ready, loading, refresh, installHref } = useProgress();
  const c = useStarChoice();
  const [checking, setChecking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  if (loading || ready || !session?.user || !session.repo) return null;
  const { repo } = session;
  const step = !repo.exists ? 1 : 2;
  const recheck = async () => { setChecking(true); await refresh(); setChecking(false); };
  // 「安装 App」会让当前页面跳走：先把 Star 点完（最多等 3 秒）再跳
  const install = async () => {
    setLeaving(true);
    await Promise.race([c.run(), new Promise((r) => setTimeout(r, 3000))]);
    window.location.href = installHref();
  };
  return (
    <Card className="reveal gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <PixelBullet />
          <span className="text-base font-semibold">两步开通你自己的进度</span>
          <span className="font-pixel text-[10px] tracking-widest text-muted">{step} / 2</span>
        </div>
        <p className="text-sm leading-6 text-muted">
          进度和题解存在你账号下的公开仓库 <span className="font-mono text-foreground">{repo.name}</span> 里。网站只申请这一个仓库的读写权限，不碰你的其他仓库。
        </p>
      </div>
      <div className="flex flex-col">
        <Step active={step === 1} done={step > 1} n={1} title="用模板创建进度仓">
          <p className="text-[13px] leading-6 text-muted">
            GitHub 会打开「新建仓库」页面，名字已经填好 <span className="font-mono text-foreground">{session.repoName}</span>，可见性选 Public，点 Create repository 就行。
          </p>
          <div className="flex flex-wrap gap-2">
            {/* 在 Button 自己的 onPress 里点 Star 再打开：Button 不让点击冒泡到外面，包一层 <a onClick> 是收不到的 */}
            <Button size="sm" onPress={() => { c.run(); window.open(session.createUrl, "_blank", "noopener,noreferrer"); }}>在 GitHub 上创建<ExternalIcon /></Button>
            <Button isPending={checking} size="sm" variant="outline" onPress={recheck}>我建好了</Button>
          </div>
        </Step>
        <Step last active={step === 2} done={false} n={2} title="把网站的 GitHub App 装到这个仓库上">
          <p className="text-[13px] leading-6 text-muted">
            安装时选 <b className="text-foreground">Only select repositories</b>，只勾 <span className="font-mono text-foreground">{session.repoName}</span>。装完会自动回到这里。
          </p>
          <div className="flex flex-wrap gap-2">
            {repo.manageUrl ? (
              <>
                <Button size="sm" onPress={() => { c.run(); window.open(repo.manageUrl!, "_blank", "noopener,noreferrer"); }}>把仓库加进已装的 App<ExternalIcon /></Button>
                <Button isPending={checking} size="sm" variant="outline" onPress={recheck}>我加好了</Button>
              </>
            ) : (
              <Button isPending={leaving} size="sm" onPress={install}>安装 GitHub App</Button>
            )}
          </div>
        </Step>
      </div>
      <StarPicker c={c} when="setup" />
    </Card>
  );
}

/**
 * 「用 GitHub 登录」按钮：点的时候记下用户勾选的仓库，登录回来后自动 Star。
 * 在 Button 自己的 onPress 里记下再跳转：Button 不让点击冒泡，包一层 <a onClick> 是收不到的。
 */
export function LoginButton({ c, size }: { c: StarChoice; size?: "sm" | "md" | "lg" }) {
  const { loginHref, starAfterLogin } = useProgress();
  return (
    <Button size={size} onPress={() => { starAfterLogin(c.chosen); window.location.href = loginHref(); }}>
      <PixelIcon cell={1.75} name="cat" />
      用 GitHub 登录
    </Button>
  );
}

/** 没登录时首页上的登录提示；下面列出请用户顺手 Star 的仓库（默认全勾） */
export function LoginHint() {
  const { loading, session } = useProgress();
  const c = useStarChoice();
  if (loading || !session?.configured || session.user) return null;
  return (
    <Card className="reveal gap-5 p-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground/[0.06]"><PixelIcon cell={2.5} name="cat" /></span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-semibold">登录后，这里显示你自己的进度</span>
            <span className="text-sm leading-6 text-muted">
              现在看到的是 0 进度。用 GitHub 登录后，进度、题解和尝试记录都存在你账号下的 <span className="font-mono">{session.repoName}</span> 仓库里，网站只申请这一个仓库的权限。
            </span>
          </div>
        </div>
        <LoginButton c={c} />
      </div>
      <StarPicker c={c} when="login" />
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
