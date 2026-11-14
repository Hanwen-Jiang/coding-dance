"use client";

import { Button, Card, ProgressBar } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import NextLink from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PixelBullet, Skel } from "@/components/pixel";
import { useProgress } from "@/lib/progress";
import { bookmarklet } from "@/lib/sync/bookmarklet.ts";
import { createBridge } from "@/lib/sync/bridge.ts";
import { createLeetCode } from "@/lib/sync/leetcode.ts";
import { buildPlan, commitPlan, finalize, type Plan } from "@/lib/sync/plan.ts";
import { createRepoClient } from "@/lib/sync/repo-client.ts";

function H2({ children, en }: { children: React.ReactNode; en: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-bold">
      <PixelBullet />
      {children}
      <span className="font-pixel text-[10px] font-normal tracking-widest text-muted">{en}</span>
    </h2>
  );
}

function Step({ n, title, state, children }: { n: number; title: string; state: "ok" | "todo" | "wait"; children: React.ReactNode }) {
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className={clsx("font-pixel grid size-6 place-items-center rounded-md text-[11px]", state === "ok" ? "bg-success text-white" : "bg-foreground text-background")}>{state === "ok" ? "✓" : n}</span>
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex flex-col gap-3 text-[15px] leading-7">{children}</div>
    </Card>
  );
}

type Bridge = ReturnType<typeof createBridge>;
type Phase = "idle" | "reading" | "plan" | "writing" | "done";

/** 被力扣拦下之后建议等多久再同步（实测见 lib/sync/限流记录.md：等 27 分钟后又能完整读一轮） */
const RETRY_HINT = "过 25～30 分钟再同步";

type Browser = "chrome" | "edge" | "firefox" | "safari" | "mobile";
const BROWSERS: { id: Browser; label: string }[] = [
  { id: "chrome", label: "Chrome" },
  { id: "edge", label: "Edge" },
  { id: "firefox", label: "火狐" },
  { id: "safari", label: "Safari" },
  { id: "mobile", label: "手机" },
];

function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  // iPad 的 Safari 会自称 Mac，靠触屏认出来
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "mobile";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\/|Chromium\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "chrome";
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded-md border border-border bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[12px]">{children}</kbd>
);

/** 每种浏览器怎么把书签放上去；默认选中当前浏览器 */
function BookmarkGuide() {
  const [b, setB] = useState<Browser>("chrome");
  useEffect(() => { setB(detectBrowser()); }, []);
  const use = <>打开 leetcode.cn 并登录，点书签栏里的「同步力扣」。</>;
  const steps: Record<Browser, React.ReactNode[]> = {
    chrome: [<>按 <Key>Ctrl</Key> <Key>Shift</Key> <Key>B</Key>（Mac 上是 <Key>⌘</Key> <Key>Shift</Key> <Key>B</Key>）显示书签栏。Brave、Arc、Opera 等 Chromium 浏览器也一样。</>, <>按住上面的「同步力扣」按钮，拖到书签栏上松开。</>, use],
    edge: [<>按 <Key>Ctrl</Key> <Key>Shift</Key> <Key>B</Key>（Mac 上是 <Key>⌘</Key> <Key>Shift</Key> <Key>B</Key>）显示收藏夹栏。</>, <>按住上面的「同步力扣」按钮，拖到收藏夹栏上松开。</>, <>打开 leetcode.cn 并登录，点收藏夹栏里的「同步力扣」。</>],
    firefox: [<>在地址栏旁边的工具栏空白处点右键，选「书签工具栏」→「总是显示」。</>, <>按住上面的「同步力扣」按钮，拖到书签工具栏上松开。</>, use],
    safari: [<>在菜单栏选「显示」→「显示个人收藏栏」（<Key>⇧</Key> <Key>⌘</Key> <Key>B</Key>）。</>, <>按住上面的「同步力扣」按钮，拖到个人收藏栏上松开。</>, <>打开 leetcode.cn 并登录，点个人收藏栏里的「同步力扣」。</>],
    mobile: [<>手机上拖不了书签，同步也要在两个标签页之间来回传消息，<b>建议用电脑</b>。一定要用手机的话：点「复制书签地址」。</>, <>随便把一个网页加入书签，再编辑这个书签：名字改成「同步力扣」，网址换成刚才复制的内容。</>, <>打开 leetcode.cn 并登录。Android 的 Chrome 在地址栏输入「同步力扣」，从下拉建议里点这个书签；iPhone 的 Safari 从书签列表里点它。不保证每种手机浏览器都能用。</>],
  };
  return (
    <div className="flex flex-col gap-2">
      <Segment aria-label="浏览器" className="max-w-full overflow-x-auto" selectedKey={b} size="sm" variant="ghost" onSelectionChange={(k) => setB(k as Browser)}>
        {BROWSERS.map((x) => <Segment.Item key={x.id} id={x.id}>{x.label}</Segment.Item>)}
      </Segment>
      <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm leading-6 text-muted marker:text-foreground/50">
        {steps[b].map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

/** 读取时的进度：有总数时按「要读的代码份数」显示进度条，翻提交列表时不知道总数，显示不定进度 */
function ReadProgress({ log, step }: { log: string; step: { done: number; total: number } | null }) {
  const known = !!step && step.total > 0;
  return (
    <ProgressBar aria-label="同步进度" className="w-full max-w-xl" isIndeterminate={!known} maxValue={known ? step!.total : 100} size="sm" value={known ? step!.done : 0}>
      {/* data-slot="label" 让它落在进度条的「标题」格子里 */}
      <span aria-live="polite" className="text-sm font-normal text-muted" data-slot="label">{log || "准备中…"}</span>
      {known && <ProgressBar.Output className="text-xs font-normal text-muted">{step!.done} / {step!.total}</ProgressBar.Output>}
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

export function SyncApp() {
  const { session, loading, loginHref, refresh } = useProgress();
  const repoReady = !!(session?.user && session.repo?.exists && session.repo.accessible);

  // 书签：React 不让直接写 javascript: 地址，挂载后再设置
  const bm = useRef<HTMLAnchorElement>(null);
  const [bmHref, setBmHref] = useState("");
  useEffect(() => {
    const href = bookmarklet(window.location.origin);
    setBmHref(href);
    bm.current?.setAttribute("href", href);
  }, []);
  const [copied, setCopied] = useState(false);

  // 被书签打开时，window.opener 就是用户的力扣页面
  const [bridge, setBridge] = useState<Bridge | null>(null);
  const [lcState, setLcState] = useState<"none" | "checking" | "lost" | "anon" | "ok">("none");
  const [lcUser, setLcUser] = useState("");
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const lc = useMemo(() => (bridge ? createLeetCode(bridge.transport, { onWait: (s) => setLog(`力扣说请求太频繁了，等 ${s} 秒再继续…`) }) : null), [bridge]);

  const connect = useCallback(async () => {
    if (!window.opener || !new URLSearchParams(window.location.search).has("from")) { setLcState("none"); return; }
    setLcState("checking");
    const b = bridge ?? createBridge(window.opener as Window);
    if (!bridge) setBridge(b);
    if (!(await b.hello())) { setLcState("lost"); return; }
    try {
      const st = await createLeetCode(b.transport, { gap: 0 }).status();
      setLcUser(st.username || "");
      setLcState(st.isSignedIn ? "ok" : "anon");
    } catch (e) {
      setLcState("lost");
      setError((e as Error).message);
    }
  }, [bridge]);
  useEffect(() => { connect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 同步
  const repo = useMemo(() => createRepoClient(), []);
  const cache = useRef(new Map());
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const onProgress = useCallback((m: string, s?: { done: number; total: number }) => { setLog(m); setStep(s ?? null); }, []);
  const [base, setBase] = useState<Plan | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const plan = useMemo(() => (base ? finalize(base, excluded) : null), [base, excluded]);
  const [done, setDone] = useState<{ url?: string; nothing?: boolean } | null>(null);

  const check = async () => {
    if (!lc) return;
    setError(""); setDone(null); setExcluded(new Set()); setPhase("reading");
    try {
      setBase(await buildPlan({ repo, lc, cache: cache.current, onProgress }));
      setPhase("plan");
    } catch (e) {
      const msg = (e as Error).message;
      setError(/频繁/.test(msg) ? `${msg}：力扣连第一页提交列表都不让读了，${RETRY_HINT}。` : msg); setPhase("idle");
    }
    setLog(""); setStep(null);
  };
  const write = async () => {
    if (!lc || !plan) return;
    setError(""); setPhase("writing");
    try {
      const res = await commitPlan({ repo, lc, plan, cache: cache.current, onProgress });
      if ("changed" in res) { setBase(res.plan); setPhase("plan"); setError("仓库在这期间变了，要写入的内容也跟着变了，请重新确认。"); return; }
      setDone("nothing" in res ? { nothing: true } : { url: res.url });
      setPhase("done");
      refresh();
    } catch (e) {
      setError((e as Error).message); setPhase("plan");
    } finally { setLog(""); setStep(null); }
  };
  const toggle = (id: string, on: boolean) => setExcluded((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });

  const busy = phase === "reading" || phase === "writing";
  return (
    <div className="flex flex-col gap-10 pt-10 sm:pt-14">
      <section className="flex flex-col gap-3">
        <span className="font-pixel text-[11px] tracking-[0.2em] text-accent">SYNC · LEETCODE.CN → GITHUB</span>
        <h1 className="text-3xl font-bold">从力扣同步提交记录</h1>
        <p className="max-w-2xl text-[15px] leading-7 text-muted">
          把你在力扣中国站上的每一次提交（通过的和没通过的）写进你自己的进度仓。不用装任何东西：一个书签，加上你在本站的 GitHub 登录。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Step n={1} state={repoReady ? "ok" : "todo"} title="登录本站">
          {loading ? <Skel className="h-6 w-40" /> : repoReady ? (
            <p>已登录 <b>{session!.user!.login}</b>，会写进 <span className="font-mono text-sm">{session!.repo!.name}</span>。</p>
          ) : session?.user ? (
            <p>还没开通进度仓。<NextLink href="/">先在首页按两步开通</NextLink>，再回来。</p>
          ) : (
            <>
              <p>用 GitHub 登录本站。同步时由本站用你的登录把记录写进你的进度仓。</p>
              <a className="no-underline" href={loginHref()}><Button size="sm">用 GitHub 登录</Button></a>
            </>
          )}
        </Step>
        <Step n={2} state="todo" title="把书签拖到书签栏（只要一次）">
          <div className="flex flex-wrap items-center gap-3">
            <a
              ref={bm}
              className="font-pixel inline-flex cursor-grab items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12px] tracking-wider text-white no-underline active:cursor-grabbing"
              draggable
              title="拖到书签栏"
              onClick={(e) => { e.preventDefault(); setError("这个按钮要拖到书签栏上，然后在 leetcode.cn 的页面里点书签。"); }}
            >
              同步力扣
            </a>
            <Button isDisabled={!bmHref} size="sm" variant="ghost" onPress={async () => { await navigator.clipboard.writeText(bmHref); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? "已复制" : "复制书签地址"}
            </Button>
          </div>
          <BookmarkGuide />
          <p className="text-sm text-muted">拖不了的话：复制书签地址，新建一个书签，把它粘贴到「网址」一栏。</p>
        </Step>
        <Step n={3} state={lcState === "ok" ? "ok" : lcState === "checking" ? "wait" : "todo"} title="在力扣上点书签">
          {lcState === "ok" ? (
            <p>已连上你的力扣页面（{lcUser}）。同步期间那个标签页要一直开着。</p>
          ) : lcState === "anon" ? (
            <p>连上了力扣页面，但还没登录。在那个页面登录力扣后，回到那里再点一次书签。</p>
          ) : lcState === "lost" ? (
            <p>和力扣页面断开了（页面被关掉或刷新过）。回到 leetcode.cn 再点一次书签。</p>
          ) : lcState === "checking" ? (
            <p>正在连接力扣页面…</p>
          ) : (
            <>
              <p>打开 leetcode.cn（先登录），点书签栏里的「同步力扣」。这个页面会在新标签页打开，然后就可以同步了。</p>
              <a className="no-underline" href="https://leetcode.cn/" rel="noopener" target="_blank"><Button size="sm" variant="outline">打开 leetcode.cn</Button></a>
            </>
          )}
        </Step>
      </section>

      {lcState === "ok" && (
        <section className="flex flex-col gap-4">
          <H2 en="SYNC">同步</H2>
          <Card className="gap-4 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button isDisabled={!repoReady || busy} onPress={check}>{phase === "plan" || phase === "done" ? "重新检查" : "检查要同步的内容"}</Button>
              <span className="text-sm text-muted">只读：先看一遍，不会写入任何东西。</span>
            </div>
            {!repoReady && <p className="text-sm text-warning">先完成第 1 步（登录本站、开通进度仓）。</p>}
            {busy ? <ReadProgress log={log} step={step} /> : log && <p aria-live="polite" className="text-sm text-muted">{log}</p>}
            {error && <p className="text-sm text-danger">{error}</p>}
            {plan && (phase === "plan" || phase === "writing") && <PlanView excluded={excluded} plan={plan} toggle={toggle} />}
            {plan && phase === "plan" && plan.writes.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.04] p-4">
                <p className="text-sm">确认后，上面这些改动会作为<b>一个 commit</b> 写进 <span className="font-mono">{plan.head.repo}</span>。</p>
                <div className="flex gap-3">
                  <Button onPress={write}>写入我的进度仓</Button>
                  <Button variant="ghost" onPress={() => { setBase(null); setPhase("idle"); setLog("没有写入任何东西。"); }}>不写了</Button>
                </div>
              </div>
            )}
            {done && (
              <p className="text-[15px]">
                {done.nothing ? "仓库已经是最新的。" : <>写入完成：<a href={done.url} rel="noopener noreferrer" target="_blank">查看这次 commit</a>。题目页的「尝试记录」一分钟内会更新。</>}
              </p>
            )}
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <H2 en="HOW IT WORKS">数据怎么走</H2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["你的力扣页面", "书签在你已登录的 leetcode.cn 页面里，替这个同步页发只读查询（提交列表、代码）。它只认本站同步页的消息，不转发任何修改数据的请求。"],
            ["这个同步页", "在你的浏览器里比对力扣上的提交和进度仓里已有的记录，列出要写入的内容，等你勾选、确认。"],
            ["本站服务器 → 你的进度仓", "用你在本站的 GitHub 登录，把确认过的内容作为一个 commit 写进去。只转手，不保存；只能写进度、尝试记录和不导入名单这三类文件。"],
          ].map(([t, d]) => (
            <Card key={t} className="gap-2 p-4">
              <div className="text-sm font-semibold">{t}</div>
              <p className="text-sm leading-6 text-muted">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <H2 en="SOURCE OF TRUTH">进度仓是唯一的数据源</H2>
        <Card className="gap-2 p-5 text-[15px] leading-7">
          <p>你的进度仓里的文件就是全部数据，本站不另存一份。每次同步都重新读仓库，靠每条记录里写的力扣提交编号（<span className="font-mono text-sm">submission</span>）判断哪些已经导入过。</p>
          <p>手写的记录（比如带分析的「错在哪里」）不会被重复导入：代码和某次力扣提交一样，就认定是同一次，只在它开头的设置里补上提交编号，其余内容一个字不动。</p>
          <p>取消勾选的提交会记进 <span className="font-mono text-sm">attempts/skip.txt</span>，以后不再列出来；删掉一条同步来的记录时，把它的编号写进这个文件，它就不会被导回来。</p>
          <p>状态只升不降：有通过的提交记「已通过」，只提交过没通过记「尝试过」；你手动标的「曾通过」只有在那之后又通过了才会改。</p>
          <p className="text-sm text-muted">每次同步先把力扣上你的提交列表从新到旧翻一遍（每页 20 条），只给进度仓里还没有的提交读代码，所以第一次最慢，以后只读新的。力扣限流比较严，会放慢速度、必要时等几分钟；还不行就停下，已经读完的题可以先写入，{RETRY_HINT}，会接着读剩下的。力扣上历史提交的失败用例拿不到，记录里只有通过了几个用例。只同步热题 100 里的题；进度仓不支持的语言（比如 SQL）导不进记录，但会算进状态。</p>
        </Card>
      </section>
    </div>
  );
}

function PlanView({ plan, excluded, toggle }: { plan: Plan; excluded: Set<string>; toggle: (id: string, on: boolean) => void }) {
  const n = plan.added.length, l = plan.linked.length, s = plan.changes.size, d = plan.dropped.length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        力扣上一共 {plan.totals.all} 次提交{plan.listCut && "（这次读到的部分）"}，其中热题 100 的 {plan.totals.hot} 次、{plan.totals.problems} 道题；进度仓里已经有 {plan.totals.known} 次，新的 {plan.totals.fresh} 次。
      </p>
      {plan.listCut && (
        <p className="text-sm text-warning">
          力扣的提交列表只让读到最近 {plan.listCut.read} 条（最早到 {new Date(plan.listCut.oldest * 1000).toLocaleDateString("zh-CN")}），更早的提交这次没看到。先写入下面这些，{RETRY_HINT}，再看更早的。
        </p>
      )}
      {plan.partial && (
        <p className="text-sm text-warning">
          力扣一直提示请求太频繁：有新提交的 {plan.partial.total} 道题只读完了 {plan.partial.done} 道（停在第 {plan.partial.next.id} 题），还有 {plan.partial.left} 次提交的代码没读。可以先写入下面这些，{RETRY_HINT}，会接着读剩下的。
        </p>
      )}
      <p className="text-[15px]">
        {plan.writes.length ? (
          <>
            要写入：新增 <b>{n}</b> 条尝试记录
            {l > 0 && <>，给 <b>{l}</b> 条手写记录补上力扣提交编号</>}
            {s > 0 && <>，<b>{s}</b> 道题的状态会变</>}
            {d > 0 && <>，<b>{d}</b> 次提交记进不导入名单</>}。取消勾选的提交不会导入，以后也不再列出来。
          </>
        ) : "仓库已经是最新的，没有要写入的内容。"}
      </p>
      {plan.perProblem.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-separator text-left text-xs text-muted">
                <th className="py-2 pe-3 font-medium">题目</th><th className="py-2 pe-3 font-medium">新增提交</th><th className="py-2 pe-3 font-medium">补编号</th><th className="py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {plan.perProblem.map((x) => {
                const named = new Map(x.files.map((f) => [f.id, f.path.split("/").pop()!]));
                return (
                  <tr key={x.problem.id} className="border-b border-separator align-top last:border-0">
                    <td className="py-2 pe-3">{x.problem.id}. {x.problem.name}</td>
                    <td className="py-2 pe-3">
                      <div className="flex flex-col gap-1 font-mono text-xs">
                        {x.candidates.map((c) => (
                          <label key={c.id} className="flex cursor-pointer items-center gap-2">
                            <input checked={!excluded.has(c.id)} className="accent-[var(--accent)]" type="checkbox" onChange={(e) => toggle(c.id, e.target.checked)} />
                            <span className={clsx(excluded.has(c.id) && "text-muted line-through")}>{named.get(c.id) ?? `${c.date} ${c.result}`}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pe-3 font-mono text-xs text-muted">{x.linked.map((f) => <div key={f.path}>{f.path.split("/").pop()}</div>)}</td>
                    <td className="py-2">{x.status ? <>{x.before} → <b>{x.status.status}</b></> : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {plan.skipped.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">跳过 {plan.skipped.length} 次提交</summary>
          <ul className="mt-2 list-disc ps-5">{plan.skipped.map((x) => <li key={String(x.sub.id)}>{x.problem.id}. {x.problem.name} · 提交 {String(x.sub.id)}：{x.reason}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
