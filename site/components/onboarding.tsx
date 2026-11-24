"use client";

// 开通页（/welcome/）：登录、授权 GitHub App 之后，新用户在这里一次弄好进度仓——选私有 / 公开，网站直接建好
// （顺手 Star），然后回到原来的页面。登录回调发现进度仓还不能用时会把人带到这里（functions/api/auth/callback.ts）。
// 首页只留一行提醒（SetupReminder），给跳过了这一步的人。
import { Button, Card, Checkbox } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { LoginButton, PixelAvatar } from "@/components/account";
import { ChevronDown, ExternalIcon } from "@/components/icons";
import { PixelIcon, Skel } from "@/components/pixel";
import { useProgress } from "@/lib/progress";
import { SETUP_PATH } from "@/lib/setup";
import type { SessionInfo, StarResult } from "@/lib/types";

/** 开通完回哪里：只认本站的相对路径，别的（和开通页自己）一律回首页 */
function readReturn(): string {
  const v = new URLSearchParams(location.search).get("return");
  return v && /^\/(?![/\\])[^\s\\]*$/.test(v) && !v.startsWith(SETUP_PATH) ? v : "/";
}

const repoOk = (s: SessionInfo | null) => !!(s?.user && s.repo?.exists && s.repo.accessible);

// —— 顺手 Star ——

/** 每个仓库一句话说明，让用户知道自己在给什么点 Star */
const STAR_INFO: Record<string, string> = {
  "Hanwen-Jiang/agent-runtime": "作者的多租户 Agent 运行核心",
  "Hanwen-Jiang/coding-agent": "建在 Agent Runtime 上的在线多租户 coding agent",
  "Hanwen-Jiang/leetcode": "这个网站，以及全部题解和动画的源码",
  "Timmononon/StoreAgent": "共创者的知识库 AI Agent 平台：RAG 问答、断点续跑、工具调用和效果评测",
  "Timmononon/my-runtime": "共创者的本地 Python AI Agent 运行时，带工具、记忆和 GitHub 自动化流程",
};

const STAR_OFF_KEY = "hot100:star-off";

/** 还没 Star 的仓库和用户的勾选（默认全勾，可以逐个取消），在用户点开通按钮时一起点；默认展开以便直接查看和勾选 */
function useStarChoice() {
  const { session, star } = useProgress();
  const pending = useMemo(() => (session?.stars ?? []).filter((s) => !s.starred).map((s) => s.repo), [session]);
  const [off, setOff] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(STAR_OFF_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr.filter((x): x is string => typeof x === "string"));
      }
    } catch {}
    return new Set();
  });
  const [results, setResults] = useState<StarResult[]>([]);
  const [open, setOpen] = useState(true);
  const chosen = pending.filter((r) => !off.has(r));
  const toggle = (repo: string, on: boolean) => setOff((s) => {
    const n = new Set(s);
    if (on) n.delete(repo);
    else n.add(repo);
    try { sessionStorage.setItem(STAR_OFF_KEY, JSON.stringify([...n])); } catch {}
    return n;
  });
  const run = async () => {
    if (!chosen.length) return [];
    const res = await star(chosen);
    setResults((old) => [...old.filter((o) => !res.some((r) => r.repo === o.repo)), ...res]);
    // 有没点上的：把列表打开，让用户看到去 GitHub 手动点的链接
    if (res.some((r) => !r.starred)) setOpen(true);
    return res;
  };
  return { all: session?.stars ?? [], pending, chosen, off, toggle, run, results, open, setOpen };
}
type StarChoice = ReturnType<typeof useStarChoice>;

const linkBtn = "inline-flex items-center gap-1 rounded-md px-1 text-xs text-muted underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent";

/** 一行小字：点按钮时会顺手 Star 几个仓库，默认展开、可点击收起 */
function StarToggle({ c, lead }: { c: StarChoice; lead: string }) {
  if (!c.all.length) return null;
  if (!c.pending.length && !c.results.some((r) => !r.starred)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <PixelIcon cell={1.25} className="text-warning" name="star" />
        已 Star 全部 {c.all.length} 个关联仓库，谢谢支持
      </span>
    );
  }
  return (
    <button aria-controls="star-list" aria-expanded={c.open} className={linkBtn} type="button" onClick={() => c.setOpen(!c.open)}>
      <PixelIcon cell={1.25} className="text-warning" name="star" />
      {c.chosen.length ? `${lead} ${c.chosen.length} / ${c.pending.length} 个仓库` : "不顺手 Star 了"}
      <ChevronDown aria-hidden className={clsx("transition-transform", c.open && "rotate-180")} height={12} width={12} />
    </button>
  );
}

/** 仓库列表：没 Star 的带勾选框；接口没点上的，给一个去 GitHub 手动点的链接 */
function StarList({ c }: { c: StarChoice }) {
  if (!c.open || !c.all.length) return null;
  return (
    <ul className="flex flex-col gap-1.5" id="star-list">
      {c.all.map(({ repo, starred }) => {
        const failed = c.results.find((r) => r.repo === repo && !r.starred);
        return (
          <li key={repo} className="flex items-start gap-3 rounded-xl border border-separator px-3 py-2">
            {starred ? (
              <span aria-label="已经 Star" className="mt-0.5 grid size-5 shrink-0 place-items-center text-warning"><PixelIcon cell={2} name="star" /></span>
            ) : (
              <Checkbox aria-label={`Star ${repo}`} className="mt-0.5" isSelected={!c.off.has(repo)} onChange={(on) => c.toggle(repo, on)}>
                <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
              </Checkbox>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-center gap-x-2">
                <a className="font-mono text-[13px] text-foreground no-underline hover:underline" href={`https://github.com/${repo}`} rel="noopener noreferrer" target="_blank">{repo}</a>
                {starred && <span className="text-xs text-success">已 Star，谢谢</span>}
              </span>
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

// —— 页面上的小部件 ——

const STEPS = ["登录 GitHub", "授权网站", "建进度仓"];

/** 顶上的三步：at 是当前这一步（0 起），前面的打勾 */
function Steps({ at }: { at: number }) {
  return (
    <ol aria-label="开通步骤" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
      {STEPS.map((t, i) => (
        <li key={t} aria-current={i === at ? "step" : undefined} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className={clsx("h-px w-4 sm:w-8", i <= at ? "bg-success/60" : "bg-separator")} />}
          <span className={clsx("font-pixel grid size-5 shrink-0 place-items-center rounded-[5px] text-[10px]", i < at ? "bg-success text-white" : i === at ? "bg-accent text-white" : "bg-foreground/10 text-muted")}>
            {i < at ? "✓" : i + 1}
          </span>
          <span className={clsx("whitespace-nowrap", i === at ? "font-semibold text-foreground" : "text-muted")}>{t}</span>
        </li>
      ))}
    </ol>
  );
}

/** 手动两步里的一步（左边序号和竖线） */
function Step({ n, title, active, done, last, children }: { n: number; title: string; active: boolean; done: boolean; last?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={clsx("font-pixel grid size-6 shrink-0 place-items-center rounded-md text-[11px]", done ? "bg-success text-white" : active ? "bg-accent text-white" : "bg-foreground/10 text-muted")}>{done ? "✓" : n}</span>
        {!last && <span aria-hidden className={clsx("my-1 w-px flex-1", done ? "bg-success/40" : "bg-separator")} />}
      </div>
      <div className={clsx("flex min-w-0 flex-1 flex-col gap-2", !last && "pb-4", !active && !done && "opacity-50")}>
        <span className="text-sm font-semibold leading-6">{title}{done && <span className="ms-2 text-xs font-normal text-success">完成</span>}</span>
        {active && children}
      </div>
    </div>
  );
}

function Visibility({ isPrivate, set, size }: { isPrivate: boolean; set: (v: boolean) => void; size?: "sm" }) {
  return (
    <Segment aria-label="仓库可见性" className="shrink-0" selectedKey={isPrivate ? "private" : "public"} size={size} onSelectionChange={(k) => set(String(k) === "private")}>
      <Segment.Item id="private">私有</Segment.Item>
      <Segment.Item id="public">公开</Segment.Item>
    </Segment>
  );
}

const Mono = ({ children }: { children: React.ReactNode }) => <span className="font-mono text-[13px] text-foreground">{children}</span>;

/** 作者和共创者。GitHub App 没有 Followers 权限，关注只能去 GitHub 上点 */
const PEOPLE = [
  { login: "Hanwen-Jiang", role: "作者", note: "题目、动画演示、六种语言的题解和这个网站" },
  { login: "Timmononon", role: "共创者", note: "题目页的在线练习：在浏览器里写代码、运行和测试" },
];

/** 页面底部一行：去 GitHub 关注作者和共创者，和「以后再说」 */
function Footer({ back }: { back: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1 text-xs text-muted">
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        想第一时间看到新内容，可以在 GitHub 上关注
        {PEOPLE.map(({ login, role, note }, i) => (
          <span key={login} className="inline-flex items-center gap-1.5">
            {i > 0 && <span>和</span>}
            {role}
            <a className="inline-flex items-center gap-1 text-foreground no-underline hover:underline" href={`https://github.com/${login}`} rel="noopener noreferrer" target="_blank" title={note}>
              <PixelAvatar size={16} src={`https://github.com/${login}.png?size=16`} />
              <span className="font-mono">{login}</span>
            </a>
          </span>
        ))}
      </span>
      <NextLink className="shrink-0 text-muted no-underline hover:text-foreground" href={back}>以后再说，先去看题 →</NextLink>
    </div>
  );
}

/** 用户说过「仓库建好了」。私有仓库在授权之前网站是看不到的，没法自己判断，只能记下用户点过 */
const CREATED_KEY = "hot100:repo-created";

/**
 * 登录了但还不能读写进度仓时的开通流程。正常只有一步：
 *   已经授权（登录时 GitHub 会接着让用户授权）→ 选私有 / 公开 → 网站直接建好进度仓（勾着的仓库顺手 Star）。
 * 其他情况：
 *   还没授权（在授权页上点了取消）→ 先去授权，回到这里再建；
 *   这次授权不能建仓库（老的授权还没同意新权限）或者用户想自己建、只授权这一个仓库 → 手动两步：去 GitHub 建仓库，再把它放进授权范围。
 */
function SetupFlow({ session, back }: { session: SessionInfo; back: string }) {
  const { refresh, installHref, createRepo } = useProgress();
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
  const repo = session.repo!;
  const markCreated = (v: boolean) => {
    setCreated(v);
    try { if (v) localStorage.setItem(CREATED_KEY, "1"); else localStorage.removeItem(CREATED_KEY); } catch { /* 存不了就只在这次访问里生效 */ }
  };
  const recheck = async () => { setChecking(true); await refresh(); setChecking(false); };
  // 去授权会让当前页面跳走：先把 Star 点完（最多等 3 秒）再跳。回来还是这一页
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
    setCreating(false); // 成功的话 ready 变真，页面接着跳回原来的地方
    if (err) setProblem(err);
  };
  const where = (
    <>进度和题解存在你账号下的 <Mono>{repo.name}</Mono> 里，{isPrivate ? "设成私有，只有你自己看得到" : "设成公开，别人也能看到"}。</>
  );
  // 网站不能替用户建仓库的两种情况：这次授权里没有建仓库的权限，或者 GitHub 拒绝了
  const cannotCreate = repo.installed && (!repo.canCreate || problem?.code === "forbidden");

  // —— 手动两步：去 GitHub 建仓库，再授权（或者把仓库加进已有的授权范围） ——
  if (manual || cannotCreate) {
    const step = repo.exists || created ? 2 : 1;
    const createUrl = session.createUrl.replace(/visibility=\w+/, `visibility=${isPrivate ? "private" : "public"}`);
    return (
      <>
        <Card className="gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-6 text-muted">
              {cannotCreate ? "现在的授权不能让网站替你建仓库，要你自己去 GitHub 建一下，再交给网站。" : "自己建仓库的话，授权时可以只选这一个仓库。"}
            </p>
            <span className="font-pixel shrink-0 pt-1 text-[10px] tracking-widest text-muted">{step} / 2</span>
          </div>
          <div className="flex flex-col">
            <Step active={step === 1} done={step > 1} n={1} title="在 GitHub 上创建进度仓">
              <p className="text-[13px] leading-6 text-muted">{where}GitHub 的「新建仓库」页面会把名字 <Mono>{session.repoName}</Mono> 和{isPrivate ? "私有" : "公开"}都填好，直接点 <b className="text-foreground">Create repository</b>。</p>
              <div className="flex flex-wrap items-center gap-2">
                <Visibility isPrivate={isPrivate} set={setPrivate} size="sm" />
                {/* 在 Button 自己的 onPress 里点 Star 再打开：Button 不让点击冒泡到外面，包一层 <a onClick> 是收不到的 */}
                <Button size="sm" onPress={() => { c.run(); window.open(createUrl, "_blank", "noopener,noreferrer"); }}>去 GitHub 创建<ExternalIcon /></Button>
                <Button isPending={checking} size="sm" variant="outline" onPress={async () => { markCreated(true); await recheck(); }}>我建好了</Button>
              </div>
            </Step>
            <Step last active={step === 2} done={false} n={2} title="授权网站读写这个仓库">
              <p className="text-[13px] leading-6 text-muted">
                {repo.manageUrl
                  ? <>在 GitHub 的授权设置里，把 <Mono>{session.repoName}</Mono> 加进「Repository access」，再点 Save。</>
                  : <>在 GitHub 的授权页面选 <b className="text-foreground">Only select repositories</b>，只勾 <Mono>{session.repoName}</Mono>，再点绿色的确认按钮，完成后会回到这里。</>}
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <StarToggle c={c} lead="点按钮时顺手 Star" />
            {!cannotCreate && <button className={linkBtn} type="button" onClick={() => setManual(false)}>← 还是让网站帮我建</button>}
          </div>
          <StarList c={c} />
        </Card>
        <Footer back={back} />
      </>
    );
  }

  // —— 还没授权：在 GitHub 的授权页上没点确认 ——
  if (!repo.installed) {
    return (
      <>
        <Steps at={1} />
        <Card className="gap-4 p-5 sm:p-6">
          <p className="text-sm leading-6 text-muted">
            授权页上选 <b className="text-foreground">All repositories</b> 最省事，只想让网站碰进度仓就选 <b className="text-foreground">Only select repositories</b>。点绿色按钮后会回到这里建仓库。
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button className="max-sm:w-full" isPending={leaving} onPress={authorize}>去 GitHub 授权</Button>
            <button className={linkBtn} type="button" onClick={() => setManual(true)}>想先自己建仓库、只授权这一个？</button>
          </div>
          <StarToggle c={c} lead="点按钮时顺手 Star" />
          <StarList c={c} />
        </Card>
        <Footer back={back} />
      </>
    );
  }

  // —— 已经授权：在这里直接建进度仓 ——
  return (
    <>
      <Steps at={2} />
      <Card className="gap-4 p-5 sm:p-6">
        <p className="text-sm leading-6 text-muted">{where}</p>
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
          // 选项和按钮一行；放不下（手机）时按钮换到下一行占满
          <div className="flex flex-wrap items-center gap-3">
            <Visibility isPrivate={isPrivate} set={setPrivate} />
            <Button className="max-sm:w-full" isPending={creating} onPress={create}>
              {creating ? "正在创建…" : c.chosen.length ? `创建进度仓，并 Star ${c.chosen.length} 个仓库` : "创建进度仓"}
            </Button>
          </div>
        )}
        {problem?.code === "failed" && <p className="text-sm text-danger">{problem.error}，可以再试一次。</p>}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <StarToggle c={c} lead="顺手 Star 的" />
          <button className={linkBtn} type="button" onClick={() => setManual(true)}>想自己去 GitHub 上建？</button>
        </div>
        <StarList c={c} />
      </Card>
      <Footer back={back} />
    </>
  );
}

/** 第 0 步（未登录）：一并加载关联仓库 Star 列表，取消勾选的选择会保留到登录回来 */
function Step0Card({ repoName }: { repoName: string }) {
  const c = useStarChoice();
  return (
    <Card className="gap-4 p-5 sm:p-6">
      <p className="text-sm leading-6 text-muted">
        登录后 GitHub 会接着请你授权网站，回到这里点一下就建好你自己的进度仓 <Mono>{repoName}</Mono>，私有还是公开由你定。
      </p>
      <LoginButton className="self-start max-sm:w-full" />
      <StarToggle c={c} lead="登录后建仓时顺手 Star" />
      <StarList c={c} />
    </Card>
  );
}

/** /welcome/ 页面 */
export function Onboarding() {
  const { loading, session, ready } = useProgress();
  const router = useRouter();
  const [back, setBack] = useState<string | null>(null);
  useEffect(() => { setBack(readReturn()); }, []);
  // 已经能用了（刚建好，或者本来就开通过）：回到原来的页面
  useEffect(() => { if (ready && back) router.replace(back); }, [ready, back, router]);

  let body: React.ReactNode;
  if (loading || back === null) {
    body = (
      <>
        <Skel className="h-5 w-72 max-w-full" />
        <Skel className="h-36 w-full rounded-3xl" />
      </>
    );
  } else if (!session?.configured) {
    body = (
      <Card className="gap-3 p-5 sm:p-6">
        <p className="text-sm leading-6 text-muted">网站的 GitHub 登录暂时没有配置，进度仓开通不了。题目、提示和题解照常能看。</p>
        <NextLink className="text-sm" href={back}>回到题目列表</NextLink>
      </Card>
    );
  } else if (!session.user) {
    body = (
      <>
        <Steps at={0} />
        <Step0Card repoName={session.repoName} />
      </>
    );
  } else if (repoOk(session)) {
    body = (
      <>
        <Steps at={3} />
        <Card className="gap-3 p-5 sm:p-6">
          <p className="text-sm leading-6 text-muted">
            进度仓 <Mono>{session.repo!.name}</Mono> 已经开通{ready ? "，正在回到刚才的页面…" : "。"}
          </p>
          <NextLink className="self-start text-sm" href={back}>{ready ? "没有自动跳转？点这里" : "回到题目列表"}</NextLink>
        </Card>
      </>
    );
  } else {
    body = <SetupFlow back={back} session={session} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pt-10 sm:pt-16">
      <header className="flex flex-col gap-2">
        <span className="font-pixel text-[11px] tracking-[0.2em] text-accent">WELCOME · SETUP</span>
        <h1 className="text-2xl font-bold sm:text-3xl">开通你的进度仓</h1>
      </header>
      {body}
    </div>
  );
}

/** 首页上的一行提醒：登录了但进度仓还不能用（跳过了开通页）时才出现，点了去开通页 */
export function SetupReminder() {
  const { loading, session } = useProgress();
  if (loading || !session?.user || !session.repo || repoOk(session)) return null;
  return (
    <NextLink className="group flex items-center justify-between gap-3 rounded-2xl border border-dashed border-warning/60 px-4 py-3 text-sm text-muted no-underline hover:text-foreground" href={SETUP_PATH}>
      <span>
        <span className="font-pixel me-2 text-[10px] tracking-wider text-warning">SETUP</span>
        进度仓还没开通，做题进度和题解暂时存不下来
      </span>
      <span className="shrink-0 whitespace-nowrap text-foreground">
        去开通<span aria-hidden className="font-pixel ms-1 inline-block text-[11px] transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </NextLink>
  );
}
