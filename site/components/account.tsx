"use client";

// 账号相关的小组件：顶栏的登录 / 账号菜单、首页的登录提示、开通进度仓的卡片、点 Star 的卡片、题目页的状态切换
import { Button, Card, Checkbox, Dropdown, Label, type Selection } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChevronDown, ExternalIcon } from "@/components/icons";
import { PixelBullet, PixelIcon, PixelTitle, StatusPixel } from "@/components/pixel";
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
  const founder = !!session.member?.founder;
  const repoUrl = session.repo?.url ?? `https://github.com/${u.login}`;
  const act = (key: React.Key) => {
    if (key === "repo") window.open(repoUrl, "_blank", "noopener");
    else if (key === "sync") router.push("/sync/");
    else if (key === "home") router.push("/");
    else if (key === "logout") logout();
  };
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`账号 ${u.login}${founder ? "（创始会员）" : ""}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent">
        <span className="relative" title={founder ? "创始会员 · 永久专业版" : undefined}>
          {/* 创始会员：头像一圈金边，头顶一顶像素皇冠 */}
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
                <PixelIcon cell={1} name="crown" />创始会员 · 永久专业版
              </span>
            )}
            <span className={clsx("text-xs", ready ? "text-success" : "text-warning")}>{ready ? "进度仓已连接" : "进度仓还没开通"}</span>
            {founder && session.member?.since && <span className="text-[11px] text-muted">{session.member.since} 起，感谢最早一批用户</span>}
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
  "Timmononon/StoreAgent": "共创者的知识库 AI Agent 平台：RAG 问答、断点续跑、工具调用和效果评测",
  "Timmononon/my-runtime": "共创者的本地 Python AI Agent 运行时，带工具、记忆和 GitHub 自动化流程",
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

/** 开通时的「顺手 Star」：说明 + 仓库列表，勾着的在用户点开通按钮时一起点 */
function StarPicker({ c }: { c: StarChoice }) {
  if (!c.all.length) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-separator pt-4">
      <span className="text-sm text-muted">
        {!c.pending.length
          ? "下面这些你都已经 Star 了，谢谢。"
          : "觉得有用的话，开通时顺手点个 Star：勾着的会在你点上面的按钮时一起点，不想点的取消勾选。"}
      </span>
      <StarList c={c} />
    </div>
  );
}

/** 作者和共创者。GitHub App 没有 Followers 权限，关注只能去 GitHub 上点 */
const PEOPLE = [
  { login: "Hanwen-Jiang", role: "作者", note: "题目、动画演示、六种语言的题解和这个网站" },
  { login: "Timmononon", role: "共创者", note: "题目页的在线练习：在浏览器里写代码、运行和测试" },
];

/** 开通卡片底部的共创人小列表：头像、分工，和去 GitHub 关注的按钮 */
function Creators() {
  return (
    <div className="flex flex-col gap-3 border-t border-separator pt-4">
      <span className="text-sm text-muted">网站是下面两位一起做的。想第一时间看到新题解和新功能，可以在 GitHub 上关注作者和共创者。</span>
      <ul className="grid gap-2 sm:grid-cols-2">
        {PEOPLE.map(({ login, role, note }) => (
          <li key={login} className="flex items-center gap-3 rounded-xl border border-separator px-3 py-2.5">
            <PixelAvatar size={32} src={`https://github.com/${login}.png?size=16`} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono text-[13px]">{login}</span>
                <span className="rounded-full bg-foreground/[0.06] px-1.5 text-[11px] text-muted">{role}</span>
              </span>
              <span className="text-xs leading-5 text-muted">{note}</span>
            </div>
            <Button aria-label={`去 GitHub 关注 ${login}`} className="shrink-0" size="sm" variant="outline" onPress={() => window.open(`https://github.com/${login}`, "_blank", "noopener,noreferrer")}>
              关注<ExternalIcon />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 开通卡片底部：顺手 Star + 共创人 */
function Extras({ c }: { c: StarChoice }) {
  return (
    <>
      <StarPicker c={c} />
      <Creators />
    </>
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

/** 用户说过「仓库建好了」。私有仓库在授权之前网站是看不到的，没法自己判断，只能记下用户点过 */
const CREATED_KEY = "hot100:repo-created";
const linkBtn = "rounded-md px-1 text-xs text-muted underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent";

function Visibility({ isPrivate, set }: { isPrivate: boolean; set: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segment aria-label="仓库可见性" selectedKey={isPrivate ? "private" : "public"} size="sm" onSelectionChange={(k) => set(String(k) === "private")}>
        <Segment.Item id="private">私有</Segment.Item>
        <Segment.Item id="public">公开</Segment.Item>
      </Segment>
      <span className="text-xs text-muted">{isPrivate ? "只有你自己看得到进度和题解。" : "别人也能看到你的进度和题解。"}</span>
    </div>
  );
}

/**
 * 登录了但还不能读写进度仓时的开通卡片。正常只有一步：
 *   已经授权（登录时 GitHub 会接着让用户授权）→ 选私有 / 公开、勾选要 Star 的仓库 → 网站直接建好进度仓。
 * 其他情况：
 *   还没授权（登录时在授权页上点了取消）→ 先去授权；
 *   这次授权不能建仓库（老的授权还没同意新权限）或者用户想自己建 → 手动两步：去 GitHub 建仓库，再把它放进授权范围。
 */
export function SetupCard() {
  const { session, ready, loading, refresh, installHref, createRepo } = useProgress();
  const c = useStarChoice();
  const [checking, setChecking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [isPrivate, setPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<{ code: string; error: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [created, setCreated] = useState(false);
  useEffect(() => {
    try { setCreated(localStorage.getItem(CREATED_KEY) === "1"); } catch { /* 读不了就从第一步开始 */ }
  }, []);
  if (loading || ready || !session?.user || !session.repo) return null;
  const { repo } = session;
  const markCreated = (v: boolean) => {
    setCreated(v);
    try { if (v) localStorage.setItem(CREATED_KEY, "1"); else localStorage.removeItem(CREATED_KEY); } catch { /* 存不了就只在这次访问里生效 */ }
  };
  const recheck = async () => { setChecking(true); await refresh(); setChecking(false); };
  // 去授权会让当前页面跳走：先把 Star 点完（最多等 3 秒）再跳
  const authorize = async () => {
    setLeaving(true);
    await Promise.race([c.run(), new Promise((r) => setTimeout(r, 3000))]);
    window.location.href = installHref();
  };
  const create = async () => {
    setCreating(true);
    setProblem(null);
    c.run(); // Star 和建仓库同时进行
    const err = await createRepo(isPrivate);
    setCreating(false);
    if (err) setProblem(err);
  };
  const head = (title: string, desc: React.ReactNode, extra?: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <PixelBullet />
        <span className="text-base font-semibold">{title}</span>
        {extra}
      </div>
      <p className="text-sm leading-6 text-muted">{desc}</p>
    </div>
  );
  const where = <>进度和题解存在你自己账号下的仓库 <span className="font-mono text-foreground">{repo.name}</span> 里，私有还是公开由你定。</>;
  // 网站不能替用户建仓库的两种情况：这次授权里没有建仓库的权限，或者 GitHub 拒绝了
  const cannotCreate = repo.installed && (!repo.canCreate || problem?.code === "forbidden");

  // —— 手动两步：去 GitHub 建仓库，再授权（或者把仓库加进已有的授权范围） ——
  if (manual || cannotCreate) {
    const step = repo.exists || created ? 2 : 1;
    const createUrl = session.createUrl.replace(/visibility=\w+/, `visibility=${isPrivate ? "private" : "public"}`);
    return (
      <Card className="reveal gap-5 p-5 sm:p-6">
        {head("两步开通你自己的进度", <>{where}{cannotCreate ? "现在的授权不能让网站替你建仓库，所以要你自己去 GitHub 上建一下。" : "自己建仓库的话，授权时可以只选这一个仓库。"}</>, <span className="font-pixel text-[10px] tracking-widest text-muted">{step} / 2</span>)}
        <div className="flex flex-col">
          <Step active={step === 1} done={step > 1} n={1} title="创建你的进度仓">
            <Visibility isPrivate={isPrivate} set={setPrivate} />
            <p className="text-[13px] leading-6 text-muted">
              GitHub 会打开「新建仓库」页面，名字 <span className="font-mono text-foreground">{session.repoName}</span> 和{isPrivate ? "私有" : "公开"}都已经选好，直接点 <b className="text-foreground">Create repository</b> 就行。
            </p>
            <div className="flex flex-wrap gap-2">
              {/* 在 Button 自己的 onPress 里点 Star 再打开：Button 不让点击冒泡到外面，包一层 <a onClick> 是收不到的 */}
              <Button size="sm" onPress={() => { c.run(); window.open(createUrl, "_blank", "noopener,noreferrer"); }}>去 GitHub 创建<ExternalIcon /></Button>
              <Button isPending={checking} size="sm" variant="outline" onPress={async () => { markCreated(true); await recheck(); }}>我建好了</Button>
            </div>
          </Step>
          <Step last active={step === 2} done={false} n={2} title="授权网站读写这个仓库">
            <p className="text-[13px] leading-6 text-muted">
              {repo.manageUrl
                ? <>在 GitHub 的授权设置里，把 <span className="font-mono text-foreground">{session.repoName}</span> 加进「Repository access」，再点 Save。</>
                : <>在 GitHub 的授权页面选 <b className="text-foreground">Only select repositories</b>，只勾 <span className="font-mono text-foreground">{session.repoName}</span>，再点绿色的确认按钮。完成后会自动回到这里。</>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {repo.manageUrl ? (
                <>
                  <Button size="sm" onPress={() => { c.run(); window.open(repo.manageUrl!, "_blank", "noopener,noreferrer"); }}>把这个仓库加进授权范围<ExternalIcon /></Button>
                  <Button isPending={checking} size="sm" variant="outline" onPress={recheck}>我加好了</Button>
                </>
              ) : (
                <Button isPending={leaving} size="sm" onPress={authorize}>去 GitHub 授权</Button>
              )}
              {!repo.exists && <button className={linkBtn} type="button" onClick={() => markCreated(false)}>还没建仓库？回到上一步</button>}
            </div>
          </Step>
        </div>
        {!cannotCreate && <div><button className={linkBtn} type="button" onClick={() => setManual(false)}>← 还是让网站帮我建</button></div>}
        <Extras c={c} />
      </Card>
    );
  }

  // —— 还没授权：登录时在 GitHub 的授权页上没点确认 ——
  if (!repo.installed) {
    return (
      <Card className="reveal gap-5 p-5 sm:p-6">
        {head("还差一步：授权", <>{where}授权之后，网站就能在这里直接帮你建好它。</>)}
        <p className="text-[13px] leading-6 text-muted">
          GitHub 的授权页面会让你选范围：选 <b className="text-foreground">All repositories</b> 最省事；只想让网站碰进度仓，就选 <b className="text-foreground">Only select repositories</b>。选好后点绿色的确认按钮，会自动回到这里。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button isPending={leaving} onPress={authorize}>去 GitHub 授权</Button>
          <button className={linkBtn} type="button" onClick={() => setManual(true)}>想先自己建仓库、只授权这一个？</button>
        </div>
        <Extras c={c} />
      </Card>
    );
  }

  // —— 已经授权：在这里直接建进度仓 ——
  return (
    <Card className="reveal gap-5 p-5 sm:p-6">
      {head("创建你的进度仓", <>{where}点一下，网站就在这里帮你建好，不用去 GitHub。</>)}
      <Visibility isPrivate={isPrivate} set={setPrivate} />
      {problem?.code === "exists" ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-warning/10 px-4 py-3">
          <p className="text-sm leading-6 text-warning">
            你的账号下已经有 <span className="font-mono">{session.repoName}</span> 了，但授权范围里没有它。把它加进去就能用，不用重新建。
          </p>
          <div className="flex flex-wrap gap-2">
            {repo.manageUrl && <Button size="sm" onPress={() => window.open(repo.manageUrl!, "_blank", "noopener,noreferrer")}>把这个仓库加进授权范围<ExternalIcon /></Button>}
            <Button isPending={checking} size="sm" variant="outline" onPress={recheck}>我加好了</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button isPending={creating} onPress={create}>
            {creating ? "正在创建…" : c.chosen.length ? `创建进度仓，并 Star ${c.chosen.length} 个仓库` : "创建进度仓"}
          </Button>
          <button className={linkBtn} type="button" onClick={() => setManual(true)}>想自己去 GitHub 上建？</button>
        </div>
      )}
      {problem && problem.code === "failed" && <p className="text-sm text-danger">{problem.error}，可以再试一次。</p>}
      <Extras c={c} />
    </Card>
  );
}

/** 「用 GitHub 登录」按钮。顺手 Star 和关注共创者都放在登录之后的开通卡片里，这里只管登录 */
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
