"use client";

// 「从力扣同步」页面。
// 第一次来：新手引导一步步带着做——页面变暗，只亮出要操作的东西，气泡讲这一步做什么：
//   ① 让书签栏露出来（箭头指向浏览器上方，按当前浏览器给快捷键）→ ② 把「同步力扣」拖上去（拖完自动下一步）
//   → ③ 打开力扣点它（等着，连上了自动打勾）。
// 用户在力扣上点书签时，书签在新标签页打开这个页面（带 ?from=leetcode），这时直接开始只读对账，确认后一次写入；
// 原来开着引导的那个页面通过 BroadcastChannel 知道已经连上了。
import { Button, Card, ProgressBar } from "@heroui/react";
import clsx from "clsx";
import NextLink from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { LoginButton, StarPicker, useStarChoice } from "@/components/account";
import { PixelBullet, PixelIcon, Skel } from "@/components/pixel";
import { useProgress } from "@/lib/progress";
import { bookmarklet } from "@/lib/sync/bookmarklet.ts";
import { createBridge } from "@/lib/sync/bridge.ts";
import { createLeetCode } from "@/lib/sync/leetcode.ts";
import { buildPlan, commitPlan, finalize, type Plan } from "@/lib/sync/plan.ts";
import { createRepoClient } from "@/lib/sync/repo-client.ts";

/** 被力扣拦下之后建议等多久再同步（实测见 lib/sync/限流记录.md：等 27 分钟后又能完整读一轮） */
const RETRY_HINT = "过 25～30 分钟再同步";
/** 同步页之间说话用的频道：书签打开的新页面连上力扣后告诉原来的页面 */
const CHANNEL = "hot100-sync";
/** 这台电脑上用书签同步成功过：下次不再自动弹引导，直接给「打开力扣」 */
const INSTALLED_KEY = "hot100:bookmark-ok";
const LEETCODE = "https://leetcode.cn/";

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 存不了就算了 */ } },
};

// ───────────────────────── 浏览器 ─────────────────────────

type Browser = "chrome" | "edge" | "firefox" | "safari" | "mobile";
interface BrowserGuide {
  name: string;
  /** 这个浏览器管书签栏叫什么 */
  bar: string;
  /** 显示书签栏的快捷键；没有快捷键时是一句话 */
  keys: string[] | null;
  how: string;
}

function guideFor(b: Browser): BrowserGuide {
  const mac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform || navigator.userAgent);
  const mod = mac ? "⌘" : "Ctrl";
  switch (b) {
    case "edge": return { name: "Edge", bar: "收藏夹栏", keys: [mod, "Shift", "B"], how: "按下面这组快捷键，收藏夹栏就会出现在地址栏下面。" };
    case "firefox": return { name: "Firefox", bar: "书签工具栏", keys: null, how: "在地址栏旁边的工具栏空白处点右键，选「书签工具栏」→「总是显示」。" };
    case "safari": return { name: "Safari", bar: "个人收藏栏", keys: ["⇧", "⌘", "B"], how: "按下面这组快捷键，个人收藏栏就会出现在地址栏下面。" };
    case "mobile": return { name: "手机浏览器", bar: "书签", keys: null, how: "" };
    default: return { name: "Chrome", bar: "书签栏", keys: [mod, "Shift", "B"], how: "按下面这组快捷键，书签栏就会出现在地址栏下面。" };
  }
}

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

// ───────────────────────── 小组件 ─────────────────────────

function Title({ children, sub, center }: { children: React.ReactNode; sub?: React.ReactNode; center?: boolean }) {
  return (
    <div className={clsx("flex flex-col gap-1.5", center && "items-center text-center")}>
      <h2 className="text-xl font-bold sm:text-2xl">{children}</h2>
      {sub && <p className="max-w-xl text-[15px] leading-7 text-muted">{sub}</p>}
    </div>
  );
}

function Note({ tone = "muted", children }: { tone?: "muted" | "warning" | "danger" | "success"; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-2xl px-4 py-3 text-sm leading-6",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "success" && "bg-success/10 text-success",
        tone === "muted" && "bg-foreground/[0.04] text-muted",
      )}
    >
      {children}
    </div>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {keys.map((k, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-muted">+</span>}
          <kbd className="min-w-9 rounded-lg border border-border border-b-[3px] bg-background px-2.5 py-1 text-center font-mono text-base font-semibold text-foreground">{k}</kbd>
        </span>
      ))}
    </span>
  );
}

/** 等待中的小圆点 */
function Pulse() {
  return (
    <span aria-hidden className="relative flex size-3 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/60" />
      <span className="relative inline-flex size-3 rounded-full bg-accent" />
    </span>
  );
}

/** 读取时的进度：有总数时按「要读的代码份数」显示进度条，翻提交列表时不知道总数，显示不定进度 */
function ReadProgress({ log, step }: { log: string; step: { done: number; total: number } | null }) {
  const known = !!step && step.total > 0;
  return (
    <ProgressBar aria-label="同步进度" className="w-full" isIndeterminate={!known} maxValue={known ? step!.total : 100} size="sm" value={known ? step!.done : 0}>
      {/* data-slot="label" 让它落在进度条的「标题」格子里 */}
      <span aria-live="polite" className="truncate text-sm font-normal text-muted" data-slot="label">{log || "准备中…"}</span>
      {known && <ProgressBar.Output className="text-xs font-normal text-muted">{step!.done} / {step!.total}</ProgressBar.Output>}
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

/** 「同步力扣」按钮的样子：真按钮和引导里飘上去的演示按钮共用 */
const PILL = "font-pixel inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-[14px] tracking-wider text-white no-underline";

// ───────────────────────── 新手引导 ─────────────────────────

type Anchor = "top" | "target" | "center";
interface TourStep {
  anchor: Anchor;
  title: React.ReactNode;
  body: React.ReactNode;
  actions: React.ReactNode;
  /** 演示：一个半透明的按钮从高亮的位置飘到页面顶上 */
  ghost?: boolean;
}

/** 跟着页面滚动、缩放，量出要高亮的元素在哪 */
function useRect(el: HTMLElement | null, on: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!on || !el) { setRect(null); return; }
    const update = () => setRect(el.getBoundingClientRect());
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const t = setInterval(update, 250); // 平滑滚动、字体加载时位置还在变
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); ro.disconnect(); clearInterval(t); };
  }, [el, on]);
  return rect;
}

/**
 * 引导层：页面变暗，高亮的地方挖一个洞（洞里的东西照常能点、能拖），旁边是说明气泡。
 * 书签栏在页面外面的上方，指向它时在页面顶上放一个跳动的箭头。
 */
function Tour({ step, index, total, target, onClose }: { step: TourStep; index: number; total: number; target: HTMLElement | null; onClose: () => void }) {
  const rect = useRect(target, step.anchor === "target");
  const [vw, setVw] = useState(0), [vh, setVh] = useState(0);
  useEffect(() => {
    const size = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    size();
    window.addEventListener("resize", size);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("resize", size); window.removeEventListener("keydown", key); };
  }, [onClose]);
  if (!vw) return null;

  const pad = 14;
  const hole = step.anchor === "target" && rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  const W = Math.min(400, vw - 32);
  let pos: React.CSSProperties;
  if (step.anchor === "top") pos = { top: 92, left: (vw - W) / 2, width: W };
  else if (hole) {
    const left = Math.max(16, Math.min(vw - W - 16, hole.x + hole.w / 2 - W / 2));
    pos = hole.y + hole.h + 16 + 260 < vh ? { top: hole.y + hole.h + 16, left, width: W } : { bottom: vh - hole.y + 16, left, width: W };
  } else pos = { top: Math.max(24, vh / 2 - 180), left: (vw - W) / 2, width: W };

  // 挡住页面上别的地方，洞里不挡
  const block = "fixed z-[70] bg-transparent";
  const blockers = hole ? (
    <>
      <div className={block} style={{ left: 0, top: 0, width: vw, height: Math.max(0, hole.y) }} />
      <div className={block} style={{ left: 0, top: hole.y + hole.h, width: vw, height: Math.max(0, vh - hole.y - hole.h) }} />
      <div className={block} style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
      <div className={block} style={{ left: hole.x + hole.w, top: hole.y, width: Math.max(0, vw - hole.x - hole.w), height: hole.h }} />
    </>
  ) : <div className={clsx(block, "inset-0")} />;

  return createPortal(
    <div aria-modal="true" role="dialog" aria-label="同步书签的设置引导">
      <svg aria-hidden className="pointer-events-none fixed inset-0 z-[70]" height={vh} width={vw}>
        <defs>
          <mask id="tour-hole">
            <rect fill="white" height={vh} width={vw} />
            {hole && <rect fill="black" height={hole.h} rx={20} width={hole.w} x={hole.x} y={hole.y} />}
          </mask>
        </defs>
        <rect fill="rgba(0,0,0,0.62)" height={vh} mask="url(#tour-hole)" width={vw} />
        {hole && <rect className="animate-pulse" fill="none" height={hole.h} rx={20} stroke="var(--accent)" strokeWidth={2} width={hole.w} x={hole.x} y={hole.y} />}
      </svg>
      {blockers}

      {step.anchor === "top" && (
        <div aria-hidden className="pointer-events-none fixed top-2 left-1/2 z-[71] flex -translate-x-1/2 flex-col items-center gap-1 text-white">
          <svg className="tour-bob drop-shadow" fill="none" height="44" viewBox="0 0 24 24" width="44"><path d="M12 20V5M5 11l7-7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
          <span className="rounded-full bg-black/50 px-3 py-1 text-xs tracking-wide">书签栏在浏览器的这上面</span>
        </div>
      )}

      {step.ghost && rect && (
        <span
          aria-hidden
          className={clsx(PILL, "tour-ghost pointer-events-none fixed z-[71] shadow-xl")}
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, "--gx": `${vw / 2 - (rect.left + rect.width / 2)}px`, "--gy": `${-rect.top + 6}px` } as React.CSSProperties}
        >
          <PixelIcon cell={1.5} name="star" />
          同步力扣
        </span>
      )}

      <div key={index} className="tour-pop fixed z-[72]" style={pos}>
        <Card className="gap-4 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={clsx("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-accent" : i < index ? "w-1.5 bg-accent/50" : "w-1.5 bg-foreground/15")} />
              ))}
              <span className="ms-2 text-xs text-muted">{index + 1} / {total}</span>
            </span>
            <button aria-label="关闭引导" className="rounded-md px-1.5 text-lg leading-none text-muted hover:text-foreground" type="button" onClick={onClose}>×</button>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-bold">{step.title}</h3>
            <div className="flex flex-col gap-3 text-[15px] leading-7 text-muted">{step.body}</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">{step.actions}</div>
        </Card>
      </div>
    </div>,
    document.body,
  );
}

// ───────────────────────── ② 放好书签 ─────────────────────────

function SetupStage() {
  const [browser, setBrowser] = useState<Browser | null>(null);
  const [installed, setInstalled] = useState(false);
  const [href, setHref] = useState("");
  const [pill, setPill] = useState<HTMLAnchorElement | null>(null);
  const [tour, setTour] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const [connected, setConnected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    const b = detectBrowser();
    const done = store.get(INSTALLED_KEY) === "1";
    setBrowser(b);
    setInstalled(done);
    setHref(bookmarklet(window.location.origin));
    // 第一次来：直接开始引导
    if (!done) { const t = setTimeout(() => setTour(0), 500); return () => clearTimeout(t); }
  }, []);
  // React 不让直接写 javascript: 地址，挂载后再设置
  useEffect(() => { if (pill && href) pill.setAttribute("href", href); }, [pill, href]);
  // 书签打开的新页面连上力扣后，会在这个频道里说一声
  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = (e) => {
        if (e.data?.type !== "connected") return;
        setConnected(String(e.data.user || ""));
        setInstalled(true);
        setTour((t) => (t === null ? null : 3));
      };
    } catch { /* 没有 BroadcastChannel 就只能让用户自己看新标签页 */ }
    return () => ch?.close();
  }, []);

  if (!browser) return <Skel className="h-56 w-full rounded-3xl" />;
  const g = guideFor(browser);
  const mobile = browser === "mobile";
  const copy = async () => { await navigator.clipboard.writeText(href); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const openLc = () => { window.open(LEETCODE, "_blank", "noopener"); setOpened(true); };
  const close = () => setTour(null);
  const go = (i: number) => setTour(i);

  const waitingBody = (
    <>
      <p>到刚打开的力扣页面（先登录），点{g.bar}上的<b className="text-foreground">「同步力扣」</b>。</p>
      <p className="flex items-center gap-3 text-sm"><Pulse />等你点书签…连上后这里会自动打勾。</p>
      <p className="text-xs leading-5">没反应？浏览器可能拦了弹窗：允许 leetcode.cn 打开新窗口，再点一次书签。</p>
    </>
  );
  const steps: TourStep[] = mobile
    ? [
        {
          anchor: "center",
          title: "手机上建议用电脑",
          body: <><p>手机上拖不了书签，同步也要在两个标签页之间来回传消息，用电脑最顺。</p><p>一定要用手机：先复制书签地址。</p></>,
          actions: <><Button size="sm" variant="ghost" onPress={close}>算了</Button><Button size="sm" onPress={async () => { await copy(); go(1); }}>复制书签地址</Button></>,
        },
        {
          anchor: "center",
          title: "新建一个书签",
          body: <p>随便把一个网页加入书签，再编辑它：名字改成<b className="text-foreground">「同步力扣」</b>，网址换成刚才复制的内容。</p>,
          actions: <><Button size="sm" variant="ghost" onPress={() => go(0)}>上一步</Button><Button size="sm" onPress={() => go(2)}>改好了</Button></>,
        },
        {
          anchor: "center",
          title: "去力扣点它",
          body: opened ? waitingBody : <p>打开 leetcode.cn 并登录。Android 的 Chrome 在地址栏输入「同步力扣」，从下拉建议里点它；iPhone 的 Safari 从书签列表里点它。</p>,
          actions: <><Button size="sm" variant="ghost" onPress={() => go(1)}>上一步</Button><Button size="sm" onPress={openLc}>{opened ? "重新打开力扣" : "打开力扣"}</Button></>,
        },
      ]
    : [
        {
          anchor: "top",
          title: <>先让{g.bar}露出来</>,
          body: g.keys ? <><p>{g.how}</p><div className="py-1"><Keys keys={g.keys} /></div><p className="text-sm">已经能看到{g.bar}，直接下一步。</p></> : <p>{g.how}</p>,
          actions: <Button size="sm" onPress={() => go(1)}>看到了，下一步</Button>,
        },
        {
          anchor: "target",
          ghost: true,
          title: "把它拖到上面去",
          body: (
            <>
              <p>按住亮着的<b className="text-foreground">「同步力扣」</b>，往上拖到{g.bar}里，松手。</p>
              <p className="text-sm">拖不了？<button className="text-accent underline-offset-2 hover:underline" type="button" onClick={copy}>{copied ? "已复制书签地址" : "复制书签地址"}</button>，新建一个书签，名字写「同步力扣」，把地址贴到「网址」一栏。</p>
            </>
          ),
          actions: <><Button size="sm" variant="ghost" onPress={() => go(0)}>上一步</Button><Button size="sm" onPress={() => go(2)}>拖好了</Button></>,
        },
        {
          anchor: "top",
          title: "去力扣点一下它",
          body: opened ? waitingBody : <p>书签放好了。打开力扣（先登录），点{g.bar}上的<b className="text-foreground">「同步力扣」</b>，同步页会在新标签页打开。</p>,
          actions: <><Button size="sm" variant="ghost" onPress={() => go(1)}>上一步</Button><Button size="sm" onPress={openLc}>{opened ? "重新打开力扣" : "打开力扣"}<PixelIcon cell={1.5} name="arrow" /></Button></>,
        },
      ];
  const all: TourStep[] = [
    ...steps,
    {
      anchor: "center",
      title: <><span className="text-success">✓</span> 连上了</>,
      body: <p>同步已经在新标签页里开始了{connected ? <>（力扣账号 <b className="text-foreground">{connected}</b>）</> : null}，去那边确认要写入的内容就行。这个页面可以关掉了。</p>,
      actions: <Button size="sm" onPress={close}>好的</Button>,
    },
  ];
  // 第 4 步只在连上之后出现；进度点只算前面几步
  const shown = tour === null ? null : Math.min(tour, all.length - 1);

  return (
    <div className="flex flex-col items-center gap-7 py-2 text-center">
      {connected !== null ? (
        <Title center sub="同步在书签打开的新标签页里进行，去那边确认要写入的内容。这个页面可以关掉了。"><span className="text-success">✓</span> 已经连上力扣</Title>
      ) : installed ? (
        <Title center sub={<>书签已经在你的{g.bar}上了。打开力扣，点「同步力扣」就行。</>}>去力扣点书签</Title>
      ) : (
        <Title center sub={<>只要设置一次，30 秒：把下面这个按钮放到{g.bar}上，以后在力扣上点它，提交记录就会同步进你的进度仓。</>}>先把「同步力扣」放到{mobile ? "书签里" : g.bar}</Title>
      )}

      {connected !== null ? (
        <NextLink className="no-underline" href="/"><Button size="lg" variant="outline">回到题目列表</Button></NextLink>
      ) : (
      <>
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-foreground/[0.02] px-10 py-8">
        <a
          ref={setPill}
          className={clsx(PILL, "cursor-grab shadow-lg shadow-accent/30 transition-transform hover:-translate-y-0.5 active:cursor-grabbing")}
          draggable
          title={`按住，拖到${g.bar}`}
          onClick={(e) => { e.preventDefault(); setClicked(true); }}
          onDragEnd={() => { if (tour === 1 && !mobile) go(2); }}
        >
          <PixelIcon cell={1.5} name="star" />
          同步力扣
        </a>
        <span className="text-xs text-muted">{clicked ? <span className="text-warning">要拖，不是点：按住它，拖到{g.bar}上</span> : <>按住它，拖到{g.bar}上</>}</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {installed ? (
          <>
            <Button size="lg" onPress={() => { openLc(); go(2); }}>打开力扣<PixelIcon cell={1.5} name="arrow" /></Button>
            <Button size="lg" variant="ghost" onPress={() => go(0)}>书签不见了？重新设置</Button>
          </>
        ) : (
          <>
            <Button size="lg" onPress={() => go(0)}>{opened ? "继续引导" : "开始引导"}</Button>
            <Button size="lg" variant="ghost" onPress={() => go(2)}>已经放好了，去力扣</Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted">按 {g.name} 显示做法{!mobile && <>，快捷键和名字都按你的浏览器来</>}。</p>
      </>
      )}

      {shown !== null && <Tour index={shown} step={all[shown]} target={pill} total={connected !== null ? all.length : steps.length} onClose={close} />}
    </div>
  );
}

// ───────────────────────── ③ 同步 ─────────────────────────

type Bridge = ReturnType<typeof createBridge>;
type Phase = "idle" | "reading" | "plan" | "writing" | "done";

function SyncStage({ repoReady }: { repoReady: boolean }) {
  const { refresh } = useProgress();
  const [bridge, setBridge] = useState<Bridge | null>(null);
  const [lcState, setLcState] = useState<"checking" | "lost" | "anon" | "ok">("checking");
  const [lcUser, setLcUser] = useState("");
  const [log, setLog] = useState("");
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const onProgress = useCallback((m: string, s?: { done: number; total: number }) => { setLog(m); setStep(s ?? null); }, []);
  const lc = useMemo(() => (bridge ? createLeetCode(bridge.transport, { onWait: (s) => setLog(`力扣说请求太频繁了，等 ${s} 秒再继续…`) }) : null), [bridge]);

  // 被书签打开时，window.opener 就是用户的力扣页面
  const connect = useCallback(async () => {
    if (!window.opener) { setLcState("lost"); return; }
    setLcState("checking"); setError("");
    const b = bridge ?? createBridge(window.opener as Window);
    if (!bridge) setBridge(b);
    if (!(await b.hello())) { setLcState("lost"); return; }
    try {
      const st = await createLeetCode(b.transport, { gap: 0 }).status();
      setLcUser(st.username || "");
      setLcState(st.isSignedIn ? "ok" : "anon");
      if (st.isSignedIn) {
        store.set(INSTALLED_KEY, "1");
        try { const ch = new BroadcastChannel(CHANNEL); ch.postMessage({ type: "connected", user: st.username || "" }); ch.close(); } catch { /* 老浏览器没有也无妨 */ }
      }
    } catch (e) {
      setLcState("lost"); setError((e as Error).message);
    }
  }, [bridge]);
  useEffect(() => { connect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const repo = useMemo(() => createRepoClient(), []);
  const cache = useRef(new Map());
  const [phase, setPhase] = useState<Phase>("idle");
  const [base, setBase] = useState<Plan | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const plan = useMemo(() => (base ? finalize(base, excluded) : null), [base, excluded]);
  const [done, setDone] = useState<{ url?: string; nothing?: boolean } | null>(null);

  const check = useCallback(async () => {
    if (!lc) return;
    setError(""); setDone(null); setExcluded(new Set()); setPhase("reading");
    try {
      setBase(await buildPlan({ repo, lc, cache: cache.current, onProgress }));
      setPhase("plan");
    } catch (e) {
      const msg = (e as Error).message;
      setError(/频繁/.test(msg) ? `${msg}：力扣连第一页提交列表都不让读，${RETRY_HINT}。` : msg); setPhase("idle");
    }
    setLog(""); setStep(null);
  }, [lc, repo, onProgress]);

  // 连上了就直接开始对账（只读，不写任何东西）
  const started = useRef(false);
  useEffect(() => {
    if (lcState === "ok" && repoReady && lc && !started.current) { started.current = true; check(); }
  }, [lcState, repoReady, lc, check]);

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

  if (lcState === "checking") {
    return <Title sub={<span className="inline-flex items-center gap-3"><Pulse />正在和你的力扣页面打招呼…</span>}>连接力扣</Title>;
  }
  if (lcState === "lost") {
    return (
      <div className="flex flex-col gap-5">
        <Title sub="这个页面要由力扣页面上的书签打开，同步期间那个力扣标签页要一直开着。它可能被关掉或刷新了。">和力扣页面断开了</Title>
        {error && <Note tone="danger">{error}</Note>}
        <div className="flex flex-wrap gap-3">
          <Button onPress={connect}>重新连接</Button>
          <a className="no-underline" href={LEETCODE} rel="noopener" target="_blank"><Button variant="outline">打开力扣，再点一次书签</Button></a>
        </div>
      </div>
    );
  }
  if (lcState === "anon") {
    return (
      <div className="flex flex-col gap-5">
        <Title sub="书签连上了力扣页面，但那边还没登录。在那个页面登录力扣后，回到那里再点一次书签。">力扣还没登录</Title>
        <div><Button variant="outline" onPress={connect}>我登录好了，再试一次</Button></div>
      </div>
    );
  }

  const busy = phase === "reading" || phase === "writing";
  return (
    <div className="flex flex-col gap-6">
      {phase === "done" && done ? (
        <div className="flex flex-col gap-5">
          <Title sub={done.nothing ? "仓库已经是最新的，没有写入任何东西。" : "题目页的「尝试记录」和首页进度一分钟内会更新。"}>
            <span className="text-success">✓</span> {done.nothing ? "已经是最新的" : "同步完成"}
          </Title>
          <div className="flex flex-wrap gap-3">
            {done.url && <a className="no-underline" href={done.url} rel="noopener noreferrer" target="_blank"><Button>查看这次 commit</Button></a>}
            <NextLink className="no-underline" href="/"><Button variant="outline">回到题目列表</Button></NextLink>
            <Button variant="ghost" onPress={check}>再检查一次</Button>
          </div>
        </div>
      ) : (
        <Title sub={<>已连上力扣{lcUser && <>账号 <b className="text-foreground">{lcUser}</b></>}。先只读地对一遍账，确认后才写入你的进度仓。</>}>
          {phase === "reading" ? "正在对账…" : phase === "writing" ? "正在写入…" : plan ? (plan.writes.length ? "确认要写入的内容" : "已经是最新的") : "同步"}
        </Title>
      )}

      {busy && <ReadProgress log={log} step={step} />}
      {!busy && log && <p aria-live="polite" className="text-sm text-muted">{log}</p>}
      {error && <Note tone="danger">{error}</Note>}
      {!repoReady && <Note tone="warning">还没开通进度仓：<NextLink href="/">先在首页按两步开通</NextLink>，再回力扣点一次书签。</Note>}

      {plan && (phase === "plan" || phase === "writing") && <PlanView excluded={excluded} plan={plan} toggle={toggle} />}

      {plan && phase === "plan" && plan.writes.length > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-background/90 p-4 shadow-lg backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">作为<b>一个 commit</b> 写进 <span className="font-mono">{plan.head.repo}</span>，取消勾选的提交以后不再列出来。</p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onPress={() => { setBase(null); setPhase("idle"); setLog("没有写入任何东西。"); }}>不写了</Button>
            <Button onPress={write}>写入我的进度仓</Button>
          </div>
        </div>
      )}
      {phase === "idle" && !plan && lc && repoReady && <div><Button onPress={check}>检查要同步的内容</Button></div>}
      {phase === "plan" && plan && !plan.writes.length && <div className="flex gap-3"><NextLink className="no-underline" href="/"><Button variant="outline">回到题目列表</Button></NextLink><Button variant="ghost" onPress={check}>再检查一次</Button></div>}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "accent" | "success" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-foreground/[0.04] px-4 py-3">
      <span className={clsx("text-2xl font-bold tabular-nums", tone === "accent" && "text-accent", tone === "success" && "text-success")}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function PlanView({ plan, excluded, toggle }: { plan: Plan; excluded: Set<string>; toggle: (id: string, on: boolean) => void }) {
  const t = plan.totals;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="条新记录" tone="accent" value={plan.added.length} />
        <Stat label="道题有新提交" value={plan.perProblem.filter((p) => p.files.length).length} />
        <Stat label="道题状态会变" tone="success" value={plan.changes.size} />
        <Stat label="次提交已在仓库里" value={t.known} />
      </div>
      <p className="text-xs text-muted">
        力扣上{plan.listCut ? "这次读到" : "一共"} {t.all} 次提交，其中热题 100 的 {t.hot} 次、{t.problems} 道题。
        {plan.linked.length > 0 && <> 另外给 {plan.linked.length} 条手写记录补上力扣提交编号。</>}
        {plan.dropped.length > 0 && <> {plan.dropped.length} 次提交记进不导入名单。</>}
      </p>
      {plan.listCut && (
        <Note tone="warning">
          力扣的提交列表只让读到最近 {plan.listCut.read} 条（最早到 {new Date(plan.listCut.oldest * 1000).toLocaleDateString("zh-CN")}），更早的这次没看到。先写入下面这些，{RETRY_HINT}，再看更早的。
        </Note>
      )}
      {plan.partial && (
        <Note tone="warning">
          力扣一直提示请求太频繁：有新提交的 {plan.partial.total} 道题只读完了 {plan.partial.done} 道（停在第 {plan.partial.next.id} 题），还有 {plan.partial.left} 次提交的代码没读。可以先写入下面这些，{RETRY_HINT}，会接着读剩下的。
        </Note>
      )}
      {plan.perProblem.length > 0 && (
        <ul className="flex flex-col divide-y divide-separator overflow-hidden rounded-2xl border border-separator">
          {plan.perProblem.map((x) => {
            const named = new Map(x.files.map((f) => [f.id, f.path.split("/").pop()!]));
            return (
              <li key={x.problem.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <NextLink className="text-[15px] font-semibold text-foreground no-underline hover:text-accent" href={`/p/${x.problem.id}/`}>{x.problem.id}. {x.problem.name}</NextLink>
                  <div className="flex flex-col gap-1 font-mono text-xs">
                    {x.candidates.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2">
                        <input checked={!excluded.has(c.id)} className="accent-[var(--accent)]" type="checkbox" onChange={(e) => toggle(c.id, e.target.checked)} />
                        <span className={clsx(excluded.has(c.id) && "text-muted line-through")}>{named.get(c.id) ?? `${c.date} ${c.result}`}</span>
                      </label>
                    ))}
                    {x.linked.map((f) => <span key={f.path} className="text-muted">补编号 · {f.path.split("/").pop()}</span>)}
                  </div>
                </div>
                {x.status && <span className="shrink-0 text-sm text-muted">{x.before} → <b className="text-foreground">{x.status.status}</b></span>}
              </li>
            );
          })}
        </ul>
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

// ───────────────────────── 页面 ─────────────────────────

/** 没登录：登录按钮，下面是顺手 Star 的仓库（默认全勾，登录回来后自动点） */
function LoginCard({ repoName }: { repoName: string }) {
  const c = useStarChoice();
  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <Title center sub={<>同步时由本站用你的 GitHub 登录，把记录写进你账号下的 <span className="font-mono">{repoName}</span>。网站能读写哪些仓库，由你在 GitHub 的授权页面上选。</>}>先用 GitHub 登录</Title>
      <LoginButton c={c} size="lg" />
      <div className="w-full max-w-lg text-left"><StarPicker c={c} when="login" /></div>
    </div>
  );
}

export function SyncApp() {
  const { session, loading } = useProgress();
  const repoReady = !!(session?.user && session.repo?.exists && session.repo.accessible);
  const [fromLc, setFromLc] = useState<boolean | null>(null);
  useEffect(() => { setFromLc(new URLSearchParams(window.location.search).has("from")); }, []);

  const view = loading || fromLc === null ? null : fromLc && session?.user ? "sync" : !repoReady ? "login" : "setup";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pt-10 sm:pt-14">
      <section className="flex flex-col items-center gap-3 text-center">
        <span className="font-pixel text-[11px] tracking-[0.2em] text-accent">SYNC · LEETCODE.CN → GITHUB</span>
        <h1 className="text-3xl font-bold sm:text-4xl">从力扣同步</h1>
        <p className="max-w-xl text-[15px] leading-7 text-muted">把你在力扣中国站的每一次提交（通过的和没通过的）写进你自己的进度仓。不用装插件：一个书签，加上你在本站的 GitHub 登录。</p>
      </section>

      <Card className="gap-6 p-6 sm:p-8">
        {view === null ? (
          <div className="flex flex-col items-center gap-3"><Skel className="h-7 w-48" /><Skel className="h-5 w-full max-w-md" /><Skel className="h-28 w-64 rounded-3xl" /></div>
        ) : view === "login" ? (
          session?.user ? (
            <div className="flex flex-col items-center gap-5 py-2">
              <Title center sub={<>已登录 <b className="text-foreground">{session.user.login}</b>。同步会写进你账号下的 <span className="font-mono">{session.repoName}</span>，先在首页按两步把它开通。</>}>先开通你的进度仓</Title>
              <NextLink className="no-underline" href="/"><Button size="lg">去首页开通</Button></NextLink>
            </div>
          ) : (
            <LoginCard repoName={session?.repoName ?? "hot100-progress"} />
          )
        ) : view === "setup" ? (
          <SetupStage />
        ) : (
          <SyncStage repoReady={repoReady} />
        )}
      </Card>

      <details className="group rounded-3xl border border-separator px-5 py-4 text-[15px] leading-7">
        <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold">
          <PixelBullet />
          数据怎么走、存在哪
          <span className="ms-auto text-xs font-normal text-muted group-open:hidden">展开</span>
        </summary>
        <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted">
          <p><b className="text-foreground">你的力扣页面</b>：书签在你已登录的 leetcode.cn 页面里，替同步页发只读查询（提交列表、代码）。它只认本站同步页的消息，不转发任何修改数据的请求。</p>
          <p><b className="text-foreground">同步页</b>：在你的浏览器里比对力扣上的提交和进度仓里已有的记录，列出要写入的内容，等你勾选、确认。</p>
          <p><b className="text-foreground">本站服务器 → 你的进度仓</b>：用你在本站的 GitHub 登录，把确认过的内容作为一个 commit 写进去。只转手，不保存；只能写进度、尝试记录和不导入名单这三类文件。</p>
          <p><b className="text-foreground">进度仓是唯一的数据源</b>：本站不另存一份，每次同步都重新读仓库，靠每条记录里的力扣提交编号判断导入过没有。手写的记录不会被重复导入：代码和某次提交一样，就只给它补上编号。取消勾选的提交记进 <span className="font-mono">attempts/skip.txt</span>，以后不再列出来。状态只升不降。</p>
          <p><b className="text-foreground">限流</b>：每次先把力扣上的提交列表从新到旧翻一遍（每页 20 条），只给仓库里还没有的提交读代码，所以第一次最慢。力扣限流比较严，会放慢速度、必要时等几分钟；还不行就停下，读完的可以先写入，{RETRY_HINT}。历史提交拿不到失败用例；只同步热题 100 里的题，进度仓不支持的语言（比如 SQL）导不进记录，但会算进状态。</p>
        </div>
      </details>
    </div>
  );
}
