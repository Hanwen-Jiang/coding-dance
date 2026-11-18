"use client";

// 像素矩阵风格的小组件：点阵字、打字机、logo、难度格、状态格、进度矩阵、加载动画。
// 首屏输出是确定性的（打字机的随机节奏只在挂载后的客户端运行）；动画用 CSS，「减少动态效果」时只保留透明度变化。
import clsx from "clsx";
import NextLink from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import type { Level, Problem, Status } from "@/lib/types";

// 5×7 点阵字体
const GLYPHS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
};

export type Tone = "ink" | "accent" | "success" | "warning" | "danger";

type Cell = { x: number; y: number; kind: "on" | "off" | "cursor"; twinkle: boolean };

function layout(text: string, pad: number, cursor: boolean) {
  const lit = new Set<string>();
  [...text].forEach((ch, k) => {
    (GLYPHS[ch.toUpperCase()] ?? []).forEach((row, r) => {
      [...row].forEach((c, col) => {
        if (c === "#") lit.add(`${pad + k * 6 + col},${pad + r}`);
      });
    });
  });
  const textCols = text.length * 6 - 1;
  const cursorCol = pad + textCols + 1;
  const cols = cursor ? cursorCol + 2 + pad : pad + textCols + pad;
  const rows = 7 + pad * 2;
  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const isCursor = cursor && x >= cursorCol && x < cursorCol + 2 && y >= pad && y < pad + 7;
      const on = lit.has(`${x},${y}`);
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      cells.push({ x, y, kind: isCursor ? "cursor" : on ? "on" : "off", twinkle: !on && !isCursor && h % 23 === 0 });
    }
  }
  return { cells, cols, rows };
}

/** 用点阵字画一段文字。pad 是四周空出的格数，空格子画成淡淡的底点。 */
export function PixelText({
  text,
  pad = 2,
  cursor = false,
  tone = "ink",
  className,
  label,
}: {
  text: string;
  pad?: number;
  cursor?: boolean;
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  const { cells, cols, rows } = layout(text, pad, cursor);
  const C = 10, S = 8;
  return (
    <svg aria-label={label ?? text} className={clsx("pixel-art", `tone-${tone}`, className)} role="img" viewBox={`0 0 ${cols * C} ${rows * C}`}>
      {cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          className={clsx("px", `px-${c.kind}`, c.twinkle && "px-twinkle")}
          height={S}
          rx={1.6}
          style={{ "--d": `${c.kind === "off" ? (c.x * 131 + c.y * 37) % 4000 : c.x * 22 + c.y * 6}ms` } as React.CSSProperties}
          width={S}
          x={c.x * C + 1}
          y={c.y * C + 1}
        />
      ))}
    </svg>
  );
}

/** 打字机轮流敲出的词，以及下面那行终端文字 */
export const TYPING_WORDS: { w: string; note: string }[] = [
  { w: "CODING", note: "~/leetcode $ solve --top100" },
  { w: "LEETCODE", note: "# 100 道热题 · 17 个专题" },
  { w: "TOP100", note: "# 按重要程度刷：Hot 20 → P0 → P1" },
  { w: "DFS", note: "# 200 岛屿数量 · 79 单词搜索 · 46 全排列" },
  { w: "BFS", note: "# 102 层序遍历 · 994 腐烂的橘子" },
  { w: "DP[I]", note: "dp[i] = dp[i - 1] + dp[i - 2]" },
  { w: "O(N)", note: "# 一遍扫描：哈希表、双指针、单调栈" },
  { w: "O(LOGN)", note: "# 每次砍掉一半 · 33 · 34 · 35 · 153" },
  { w: "HASHMAP", note: "if target - x in seen: return [seen[target - x], i]" },
  { w: "STACK", note: "# 20 有效的括号 · 739 每日温度 · 84 柱状图" },
  { w: "HEAP", note: "heapq.heappush(heap, (count, x))" },
  { w: "TRIE", note: "node = node.setdefault(c, {})" },
  { w: "GREEDY", note: "far = max(far, i + nums[i])" },
  { w: "YIELD", note: "yield from dfs(node.left)" },
  { w: "LAMBDA", note: "nums.sort(key=lambda x: x == 0)" },
  { w: "AC!", note: "# Accepted · 下一题" },
];

/**
 * 打字机效果的点阵字：一个字符一个字符敲出来，光标跟着走。
 * 敲完停一段随机时间，再随机退格（有时整个删掉，有时只删到和下一个词相同的前缀），换下一个词；
 * 偶尔还会敲错一个字母、删掉重敲。打字和退格时光标常亮，停下来时光标闪烁。
 * 只画亮着的像素，不画底格，直接落在页面的点阵底纹上。
 */
export function TypingPixels({ className, onWord }: { className?: string; onWord?: (i: number) => void }) {
  const pad = 1;
  const maxLen = Math.max(...TYPING_WORDS.map((x) => x.w.length));
  const cols = pad + maxLen * 6 + 2 + pad;
  const rows = 7 + pad * 2;
  const [shown, setShown] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const wait = (ms: number) => new Promise<void>((r) => (timer = setTimeout(r, ms)));
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const set = (t: string) => alive && setShown(t);
    (async () => {
      let cur = 0, text = "";
      await wait(500);
      while (alive) {
        const target = TYPING_WORDS[cur].w;
        onWord?.(cur);
        setBusy(true);
        // 有时在中途敲错一个字母，停一下，删掉再接着敲
        const typoAt = Math.random() < 0.3 && target.length > 3 ? Math.floor(rand(text.length + 1, target.length)) : -1;
        while (alive && text !== target) {
          if (text.length === typoAt) {
            const wrong = "QWERTYUIOPASDFGHJKLZXCVBNM"[Math.floor(Math.random() * 26)];
            set(text + wrong);
            await wait(rand(320, 520));
            set(text);
            await wait(rand(120, 220));
          }
          text = target.slice(0, text.length + 1);
          set(text);
          await wait(rand(95, 230));
        }
        if (!alive) break;
        setBusy(false);
        await wait(rand(3200, 7200));
        let next = cur;
        while (next === cur) next = Math.floor(Math.random() * TYPING_WORDS.length);
        const nw = TYPING_WORDS[next].w;
        let common = 0;
        while (common < text.length && common < nw.length && text[common] === nw[common]) common++;
        const keep = Math.random() < 0.5 ? common : 0;
        setBusy(true);
        while (alive && text.length > keep) {
          text = text.slice(0, -1);
          set(text);
          await wait(rand(40, 85));
        }
        await wait(rand(220, 520));
        cur = next;
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // onWord 只在挂载时读取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lit = useMemo(() => {
    const out: [number, number][] = [];
    [...shown].forEach((ch, k) =>
      (GLYPHS[ch] ?? GLYPHS[" "]).forEach((row, r) =>
        [...row].forEach((c, col) => {
          if (c === "#") out.push([pad + k * 6 + col, pad + r]);
        }),
      ),
    );
    return out;
  }, [shown]);

  const C = 10, S = 8, cx = pad + shown.length * 6;
  return (
    <svg aria-label={shown || "CODING"} className={clsx("pixel-art tone-ink", className)} role="img" viewBox={`0 0 ${cols * C} ${rows * C}`}>
      {lit.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          className="px px-on"
          height={S}
          rx={1.6}
          style={{ "--d": `${(y - pad) * 14}ms` } as React.CSSProperties}
          width={S}
          x={x * C + 1}
          y={y * C + 1}
        />
      ))}
      {Array.from({ length: 14 }, (_, k) => {
        const x = cx + (k % 2), y = pad + Math.floor(k / 2);
        return (
          <rect
            key={`c-${k}`}
            className={clsx("px px-cursor", busy && "solid")}
            height={S}
            rx={1.6}
            style={{ "--d": "0ms" } as React.CSSProperties}
            width={S}
            x={x * C + 1}
            y={y * C + 1}
          />
        );
      })}
    </svg>
  );
}

/**
 * 任意文字（包括中文）的像素化：在 canvas 上按 px 像素高的点阵把文字画出来，
 * 每个被笔画覆盖的像素变成一个小方块。真实文字留给屏幕阅读器，挂载后点阵淡入。
 */
export function PixelTitle({
  text,
  px = 16,
  weight = 600,
  cell = 4,
  as: Tag = "div",
  className,
  cellClassName,
}: {
  text: string;
  /** 光栅化时的字号，也就是一行字有多少个像素高 */
  px?: number;
  weight?: number;
  /** 每个像素格在页面上的边长（px） */
  cell?: number;
  as?: "h1" | "div" | "p";
  className?: string;
  cellClassName?: string;
}) {
  const [grid, setGrid] = useState<{ w: number; h: number; on: [number, number][] } | null>(null);

  useLayoutEffect(() => {
    const font = `${weight} ${px}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Inter", sans-serif`;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 2;
    const h = Math.ceil(px * 1.25);
    c.width = w;
    c.height = h;
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    ctx.fillText(text, 1, h / 2 + 0.5);
    const data = ctx.getImageData(0, 0, w, h).data;
    const on: [number, number][] = [];
    let minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 110) {
          on.push([x, y]);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (!on.length) return;
    setGrid({ w, h: maxY - minY + 1, on: on.map(([x, y]) => [x, y - minY]) });
  }, [text, px, weight]);

  // 普通文字只给屏幕阅读器；像素画出来之前先按估算的高度占好位置（窄屏上按比例缩小），画出来后由 SVG 自己撑开
  const units = [...text].reduce((s, ch) => s + (/[　-鿿＀-￯]/.test(ch) ? 1 : 0.62), 0);
  const reserve = `min(${Math.round(px * 1.05 * cell)}px, calc((100vw - 32px) * ${(1.05 / units).toFixed(4)}))`;
  return (
    <Tag className={clsx("pixel-title", className)} style={grid ? undefined : { minHeight: reserve }}>
      <span className="sr-only">{text}</span>
      {grid && (
        <svg aria-hidden className="block h-auto max-w-full" style={{ width: `${grid.w * cell}px` }} viewBox={`0 0 ${grid.w} ${grid.h}`}>
          {grid.on.map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              className={clsx("pt-px", cellClassName)}
              height={0.84}
              rx={0.14}
              style={{ "--d": `${x * 9 + y * 5}ms` } as React.CSSProperties}
              width={0.84}
              x={x + 0.08}
              y={y + 0.08}
            />
          ))}
        </svg>
      )}
    </Tag>
  );
}

// 像素图标：每个字符串是一行，# 是亮的像素
const ICONS: Record<string, string[]> = {
  sun: ["....#....", ".#.....#.", "...###...", "..#####..", "#.#####.#", "..#####..", "...###...", ".#.....#.", "....#...."],
  moon: ["...###...", "..##.....", ".##......", ".##......", ".##......", ".##......", ".###...#.", "..######.", "...####.."],
  arrow: ["...####", ".....##", "....#.#", "...#..#", "..#....", ".#.....", "#......"],
  dice: ["#######", "#.....#", "#.#...#", "#..#..#", "#...#.#", "#.....#", "#######"],
  cat: ["#.......#", "##.....##", "#########", "##.###.##", "#########", ".#######.", "..##.##..", "..#...#.."],
  exit: ["####...", "#......", "#...#..", "#.#####", "#...#..", "#......", "####..."],
  star: ["....#....", "....#....", "...###...", "#########", ".#######.", "..#####..", "..##.##..", ".##...##."],
  crown: ["#...#...#", "##.###.##", "#########", ".#######.", ".#.#.#.#.", "#########"],
};

export function PixelIcon({ name, cell = 2, className }: { name: keyof typeof ICONS; cell?: number; className?: string }) {
  const rows = ICONS[name];
  const w = rows[0].length, h = rows.length;
  return (
    <svg aria-hidden className={clsx("pixel-icon", className)} style={{ width: w * cell, height: h * cell }} viewBox={`0 0 ${w} ${h}`}>
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} fill="currentColor" height={0.84} rx={0.12} width={0.84} x={x + 0.08} y={y + 0.08} /> : null)),
      )}
    </svg>
  );
}

// logo：点阵的 </>，只画笔画上的像素，没有底色和底点。13 列 × 7 行：< 4 列、/ 3 列、> 4 列，中间各空 1 列
const LOGO_ROWS = (() => {
  const lt = ["...#", "..#.", ".#..", "#...", ".#..", "..#.", "...#"];
  const sl = ["..#", "..#", ".#.", ".#.", ".#.", "#..", "#.."];
  const gt = ["#...", ".#..", "..#.", "...#", "..#.", ".#..", "#..."];
  return lt.map((_, r) => lt[r] + "." + sl[r] + "." + gt[r]);
})();

/**
 * 练习区收起后右边的把手：和 logo 同一套像素，分成 <、/、> 三组，样式（平时只露一个淡淡的 <，
 * 鼠标移上去 < 往左跳开、/ 和 > 一格一格蹦出来）写在 practice.css 的 .practice-rail。--d 是按列错开的延迟。
 */
export function PixelCodeMark({ className }: { className?: string }) {
  const C = 4, S = 3;
  const part = (x: number) => (x <= 3 ? "lt" : x <= 7 ? "sl" : "gt");
  const groups: Record<string, React.ReactNode[]> = { lt: [], sl: [], gt: [] };
  LOGO_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== "#") return;
      groups[part(x)].push(
        <rect key={`${x}-${y}`} height={S} rx={0.6} style={{ "--d": `${(x - 4) * 30 + y * 8}ms` } as React.CSSProperties} width={S} x={x * C + 0.5} y={y * C + 0.5} />,
      );
    }),
  );
  return (
    <svg aria-hidden className={clsx("pixel-codemark", className)} viewBox={`0 0 ${13 * C} ${7 * C}`}>
      <g className="cm-lt">{groups.lt}</g>
      <g className="cm-sl">{groups.sl}</g>
      <g className="cm-gt">{groups.gt}</g>
    </svg>
  );
}

export function PixelLogo({ className }: { className?: string }) {
  const rows = LOGO_ROWS;
  const C = 4, S = 3;
  return (
    <svg aria-hidden className={clsx("pixel-logo", className)} viewBox={`0 0 ${13 * C} ${7 * C}`}>
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => ch !== "#" ? null : (
          <rect
            key={`${x}-${y}`}
            className={x >= 5 && x <= 7 ? "lg-slash" : "lg-on"}
            height={S}
            rx={0.6}
            style={{ "--d": `${x * 35}ms` } as React.CSSProperties}
            width={S}
            x={x * C + 0.5}
            y={y * C + 0.5}
          />
        )),
      )}
    </svg>
  );
}

const LEVEL_N: Record<Level, number> = { 简单: 1, 中等: 2, 困难: 3 };
const LEVEL_TONE: Record<Level, string> = { 简单: "bg-success", 中等: "bg-warning", 困难: "bg-danger" };

/** 难度：三个像素格，亮几个表示几级 */
export function LevelPixels({ level, withLabel = true }: { level: Level; withLabel?: boolean }) {
  const n = LEVEL_N[level];
  return (
    <span className="level-pixels inline-flex items-center gap-1.5 text-xs text-muted" title={level}>
      <span className="inline-flex gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className={clsx("lp size-[7px] rounded-[2px]", i < n ? LEVEL_TONE[level] : "bg-foreground/10")} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </span>
      {withLabel && level}
    </span>
  );
}

export const STATUS_TONE: Record<Status, string> = { 已通过: "bg-success", 曾通过: "bg-warning", 尝试过: "bg-danger", 未开始: "bg-foreground/15" };

export function StatusPixel({ status, withLabel = true, className }: { status: Status; withLabel?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <span aria-hidden className={clsx("size-2 rounded-[2px]", STATUS_TONE[status])} />
      {withLabel ? status : <span className="sr-only">{status}</span>}
    </span>
  );
}

/**
 * 进度矩阵：每道题一个像素格，颜色表示状态，点一下进入这道题。
 * 数据还没到时先画 100 个灰格子占位；数据到了，同一批格子按顺序变色，布局不跳。
 */
/** cellProps：给每个格子加事件（首页用它挂预览，见 matrix-preview.tsx）；不传时格子上用浏览器自带的提示 */
export function ProgressMatrix({ problems, count = 100, cellProps }: { problems: Problem[] | null; count?: number; cellProps?: (p: Problem) => Partial<React.ComponentProps<typeof NextLink>> }) {
  const n = problems?.length || count;
  return (
    <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[5px] sm:grid-cols-[repeat(25,minmax(0,1fr))] lg:grid-cols-[repeat(50,minmax(0,1fr))]">
      {Array.from({ length: n }, (_, i) => {
        const p = problems?.[i];
        return (
          <NextLink
            key={i}
            aria-hidden={!p}
            aria-label={p ? `${p.id}. ${p.name}（${p.status}）` : undefined}
            className={clsx(
              "matrix-cell aspect-square rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
              p ? STATUS_TONE[p.status] : "skel pointer-events-none bg-foreground/10",
            )}
            href={p ? `/p/${p.id}/` : "/"}
            prefetch={false}
            style={{ "--i": i } as React.CSSProperties}
            tabIndex={p ? undefined : -1}
            title={p && !cellProps ? `${p.id}. ${p.name} · ${p.status}` : undefined}
            {...(p && cellProps ? cellProps(p) : {})}
          />
        );
      })}
    </div>
  );
}

/** 骨架条：淡淡地呼吸，用在内容还没加载出来的位置 */
export function Skel({ className }: { className?: string }) {
  return <span aria-hidden className={clsx("skel block rounded-md bg-foreground/[0.07]", className)} />;
}

/** 加载中：3×3 像素格轮流亮起 */
export function PixelLoader({ label = "加载中" }: { label?: string }) {
  const order = [0, 1, 2, 5, 8, 7, 6, 3, 4];
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-xs text-muted">
      <span aria-hidden className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }, (_, k) => (
          <span key={k} className="loader-px size-2.5 rounded-[2px] bg-accent" style={{ "--i": order.indexOf(k) } as React.CSSProperties} />
        ))}
      </span>
      <span className="font-pixel tracking-wider">{label}</span>
    </div>
  );
}

/** 标题前的小像素块：2×2，其中一格缓慢闪烁 */
export function PixelBullet() {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-[3px]">
      <span className="size-[6px] rounded-[1.5px] bg-accent" />
      <span className="bullet-blink size-[6px] rounded-[1.5px] bg-accent/40" />
      <span className="size-[6px] rounded-[1.5px] bg-accent/40" />
      <span className="size-[6px] rounded-[1.5px] bg-accent" />
    </span>
  );
}
