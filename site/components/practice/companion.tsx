"use client";

import { Button, Chip, Spinner } from "@heroui/react";
import clsx from "clsx";
import { Fragment, useEffect, useRef, useState } from "react";

import {
  type CompanionConsentMode,
  type CompanionHintLevel,
  type CompanionMessage,
  HINT_LEVEL_META,
  type HintCheckResponse,
  type HistoryAnalyzeResponse,
  analyzeCompanionHistory,
  attemptsToSubmissions,
} from "@/lib/companion";
import type { PracticeMode } from "@/lib/practice/types";
import type { Attempt } from "@/lib/types";

const NEXT_LEVEL: Partial<Record<CompanionHintLevel, CompanionHintLevel>> = {
  L1: "L2",
  L2: "L3",
  L3: "L4",
};

type BuddyMood = "idle" | "thinking" | "curious" | "celebrate";

/**
 * 站点像素风格的小舞 AI 伴学伙伴头像（8×8 SVG 像素矩阵）。
 * 根据状态切换表情：idle（微笑）、thinking（运算波纹）、curious（提问眨眼）、celebrate（AC 开心）。
 */
export function BuddyAvatar({ mood = "idle", size = 24 }: { mood?: BuddyMood; size?: number }) {
  const accentFill = mood === "celebrate" ? "var(--success)" : mood === "curious" ? "var(--warning)" : "var(--accent)";
  return (
    <span
      aria-hidden
      className={clsx(
        "relative grid shrink-0 place-items-center rounded-lg border border-border bg-surface shadow-xs",
        mood === "thinking" && "animate-pulse",
      )}
      style={{ width: size + 6, height: size + 6 }}
    >
      <svg height={size} viewBox="0 0 8 8" width={size}>
        {/* 天线 */}
        <rect fill={accentFill} height="1" rx="0.2" width="1" x="3.5" y="0.4" />
        {/* 头部方框 */}
        <rect fill="var(--surface-secondary)" height="5.4" rx="1.2" stroke="var(--border)" strokeWidth="0.6" width="6.4" x="0.8" y="1.7" />
        {/* 像素眼睛 */}
        {mood === "celebrate" ? (
          <>
            <path d="M2.2 4.2 2.8 3.6 3.4 4.2" fill="none" stroke={accentFill} strokeLinecap="round" strokeWidth="0.65" />
            <path d="M4.6 4.2 5.2 3.6 5.8 4.2" fill="none" stroke={accentFill} strokeLinecap="round" strokeWidth="0.65" />
          </>
        ) : mood === "thinking" ? (
          <>
            <rect fill={accentFill} height="0.9" rx="0.2" width="1.1" x="2.1" y="3.6" />
            <rect fill={accentFill} height="0.9" rx="0.2" width="1.1" x="4.8" y="3.6" />
          </>
        ) : (
          <>
            <rect fill={accentFill} height="1.1" rx="0.25" width="1.1" x="2.2" y="3.5" />
            <rect fill={accentFill} height={mood === "curious" ? "0.7" : "1.1"} rx="0.25" width="1.1" x="4.7" y={mood === "curious" ? "3.8" : "3.5"} />
          </>
        )}
        {/* 嘴 */}
        <rect
          fill="var(--foreground)"
          height="0.55"
          opacity="0.7"
          rx="0.2"
          width={mood === "celebrate" ? "2.4" : "1.6"}
          x={mood === "celebrate" ? "2.8" : "3.2"}
          y="5.35"
        />
      </svg>
    </span>
  );
}

/** 轻量级消息格式渲染：支持 **加粗** 与 `行内代码` 片段。 */
function RichInline({ text }: { text: string }) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
          return (
            <code className="rounded bg-foreground/[0.08] px-1 py-0.5 font-mono text-[11px] text-foreground" key={i}>
              {tok.slice(1, -1)}
            </code>
          );
        }
        if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
          return (
            <strong className="font-semibold text-foreground" key={i}>
              {tok.slice(2, -2)}
            </strong>
          );
        }
        return <Fragment key={i}>{tok}</Fragment>;
      })}
    </>
  );
}

/** 编辑器下方主动询问横幅（防剧透 · 征求同意后才生成提示）。 */
export function CompanionPromptBanner({
  prompt,
  loading,
  onAccept,
  onDismiss,
}: {
  prompt: HintCheckResponse;
  loading: boolean;
  onAccept: (level: CompanionHintLevel) => void;
  onDismiss: () => void;
}) {
  const recommended = prompt.recommended_level ?? "L1";
  return (
    <div className="practice-notice" data-testid="practice-companion-prompt" role="status">
      <BuddyAvatar mood={loading ? "thinking" : "curious"} size={18} />
      <span className="min-w-0 flex-1 text-xs leading-5">
        {prompt.prompt_text || "小舞发现这里有点卡住，要不要看一条不剧透的切入方向？"}
      </span>
      <Button
        className="practice-tb-btn"
        isDisabled={loading}
        onPress={() => onAccept(recommended)}
        size="sm"
        variant="secondary"
      >
        {loading ? "思考中…" : `让小舞看看 (${recommended})`}
      </Button>
      <Button className="practice-tb-btn" isDisabled={loading} onPress={onDismiss} size="sm" variant="ghost">
        我再想想
      </Button>
    </div>
  );
}

/** 活跃对话式 AI 伴学面板：L1–L4 渐进层次 + 一键快捷场景追问 + 自由问答对话流。 */
export function PracticeCompanionPanel({
  consentMode,
  mode,
  selectedLevel,
  messages,
  loading,
  error,
  llmEnabled,
  hasFailedRun,
  allPassedRun,
  onSelectAndReveal,
  onSendQuestion,
}: {
  consentMode: CompanionConsentMode;
  mode: PracticeMode;
  selectedLevel: CompanionHintLevel;
  messages: CompanionMessage[];
  loading: boolean;
  error: string | null;
  llmEnabled: boolean | null;
  hasFailedRun: boolean;
  allPassedRun: boolean;
  onSelectAndReveal: (level: CompanionHintLevel) => void;
  onSendQuestion: (question: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length, loading]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastLevel = lastAssistant?.hint_level ?? selectedLevel;
  const nextLevel = NEXT_LEVEL[lastLevel];

  const contextQuickPrompts = hasFailedRun
    ? ["分析当前失败用例的错因", "检查我的代码漏了哪个边界？", ...(mode === "acm" ? ["ACM 输入输出格式哪里容易错？"] : [])]
    : allPassedRun
      ? ["点评我的代码复杂度和可读性", "这题在面试时常怎么追问？", "还有更省空间的做法吗？"]
      : mode === "acm"
        ? ["这题 ACM 模式的输入输出怎么写？", "给我一个不剧透的突破口", "这题有哪些高频坑？"]
        : ["给我一个不剧透的突破口", "帮我看看当前代码思路对吗？", "这题有哪些高频坑？"];

  const submit = () => {
    const q = draft.trim();
    if (!q || loading) return;
    setDraft("");
    onSendQuestion(q);
  };

  const buddyMood: BuddyMood = loading ? "thinking" : allPassedRun ? "celebrate" : hasFailedRun ? "curious" : "idle";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5" data-testid="practice-companion-panel">
      {/* 顶部：伙伴状态 + L1-L4 渐进按钮 + 引擎标识 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="渐进提示层级">
          {HINT_LEVEL_META.map((item) => (
            <button
              aria-pressed={selectedLevel === item.id}
              className={clsx(
                "rounded-md border px-2 py-0.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                selectedLevel === item.id
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-border text-muted hover:text-foreground",
              )}
              disabled={loading}
              key={item.id}
              onClick={() => onSelectAndReveal(item.id)}
              title={item.desc}
              type="button"
            >
              {item.short}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-md bg-foreground/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-muted"
            title={
              llmEnabled
                ? "已接入真实大语言模型实时诊断"
                : "当前使用题目语义 + 静态代码诊断引擎；在 Pages 配置 LLM_API_KEY 即可升级为完整大模型对话"
            }
          >
            {llmEnabled ? "LLM 实时诊断" : "题库语义助教"}
          </span>
          <Chip size="sm" variant="soft">
            {consentMode === "proactive_consent" ? "主动守护" : "按需召唤"}
          </Chip>
        </div>
      </div>

      {/* 消息流 / 初次欢迎卡片 */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        {messages.length === 0 && !loading && (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-foreground/[0.02] p-3">
            <BuddyAvatar mood={buddyMood} size={22} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground">你好，我是小舞</span>
                <span className="text-[11px] text-muted">先想后看 · 绝不直接剧透答案</span>
              </div>
              <p className="m-0 text-xs leading-5 text-muted">
                {hasFailedRun
                  ? "刚才有测试没通过，我可以帮你逐行检查当前代码与失败用例；点下方快捷提问或切换上方 L1–L4 层级即可开始。"
                  : allPassedRun
                    ? "刚刚全部用例都跑通了！想一起复盘复杂度、边界或者对比一下面试高阶写法吗？"
                    : "写到一半卡住了、对边界不踏实、或者不确定 ACM 输入输出怎么解析，随时点击下面快捷问题或直接发消息给我。"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {contextQuickPrompts.map((q) => (
                  <button
                    className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-foreground/85 transition-colors hover:border-accent hover:text-accent"
                    key={q}
                    onClick={() => onSendQuestion(q)}
                    type="button"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            className={clsx(
              "flex gap-2 rounded-xl px-3 py-2.5 text-xs leading-5",
              msg.role === "user"
                ? "ml-6 self-end border border-accent/25 bg-accent/[0.08] text-foreground"
                : "border border-border bg-foreground/[0.02] text-foreground",
            )}
            key={msg.id}
          >
            {msg.role === "assistant" && <BuddyAvatar mood={msg.engine === "llm" ? "celebrate" : "idle"} size={18} />}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {msg.title && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{msg.title}</span>
                  {msg.hint_level && (
                    <Chip color="accent" size="sm" variant="soft">
                      {msg.hint_level}
                    </Chip>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5 whitespace-pre-wrap leading-6">
                {msg.content.split("\n\n").map((para, idx) => (
                  <p className="m-0" key={idx}>
                    <RichInline text={para} />
                  </p>
                ))}
              </div>
              {msg.next_steps && msg.next_steps.length > 0 && (
                <ul className="m-0 flex list-disc flex-col gap-0.5 pl-4 text-[11px] leading-5 text-muted">
                  {msg.next_steps.map((step, i) => (
                    <li key={i}>
                      <RichInline text={step} />
                    </li>
                  ))}
                </ul>
              )}
              {msg.quick_replies && msg.quick_replies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {msg.quick_replies.map((qr) => (
                    <button
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
                      disabled={loading}
                      key={qr}
                      onClick={() => onSendQuestion(qr)}
                      type="button"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-foreground/[0.02] px-3 py-2.5 text-xs text-muted" role="status">
            <BuddyAvatar mood="thinking" size={18} />
            <Spinner size="sm" />
            <span>小舞正在结合你的代码、报错和当前题型组织思路…</span>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs leading-5 text-danger" role="alert">
            {error}
          </p>
        )}

        {!loading && messages.length > 0 && nextLevel && (
          <div className="flex justify-end">
            <Button
              className="practice-tb-btn"
              onPress={() => onSelectAndReveal(nextLevel)}
              size="sm"
              variant="secondary"
            >
              还不够清晰，再深一层（{nextLevel}）
            </Button>
          </div>
        )}
        <div ref={feedEndRef} />
      </div>

      {/* 底部自由提问输入栏 */}
      <form
        className="flex shrink-0 items-center gap-1.5 border-t border-separator pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          aria-label="向 AI 助教小舞提问"
          className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
          disabled={loading}
          maxLength={400}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="问小舞关于思路、报错、边界或复杂度…"
          type="text"
          value={draft}
        />
        <Button
          className="practice-tb-btn"
          isDisabled={loading || !draft.trim()}
          size="sm"
          type="submit"
          variant="primary"
        >
          发送
        </Button>
      </form>
    </div>
  );
}

/** 尝试记录区的 AI 历史复盘卡片。 */
export function AttemptsCompanionReview({
  attempts,
  topic,
  consentMode,
}: {
  attempts: Attempt[];
  topic: string;
  consentMode: CompanionConsentMode;
}) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<HistoryAnalyzeResponse | null>(null);

  if (consentMode === "off" || attempts.length === 0) return null;

  const runReview = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeCompanionHistory({
        consent_mode: consentMode,
        user_consented: true,
        submissions: attemptsToSubmissions(attempts, topic),
      });
      setAnalysis(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BuddyAvatar mood={loading ? "thinking" : "idle"} size={18} />
          <span className="text-xs text-muted">小舞可以结合本站与力扣历史尝试，总结你的高频失误点。</span>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <Button onPress={() => setOpen(false)} size="sm" variant="ghost">
              收起复盘
            </Button>
          )}
          <Button isDisabled={loading} onPress={() => void runReview()} size="sm" variant="secondary">
            {loading ? "分析中…" : analysis ? "重新生成 AI 复盘" : "AI 复盘记录"}
          </Button>
        </div>
      </div>

      {open && error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      {open && !error && analysis && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-foreground/[0.02] p-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="soft">
              样本 {analysis.summary.total_submissions} 次
            </Chip>
            <Chip color="success" size="sm" variant="soft">
              通过率 {Math.round(analysis.summary.pass_rate * 100)}%
            </Chip>
            {analysis.weak_tags?.slice(0, 3).map((wt) => (
              <Chip color="warning" key={wt.tag} size="sm" variant="soft">
                {wt.tag} · 失误 {wt.failures} 次
              </Chip>
            ))}
          </div>
          {analysis.recommendations.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">改进建议</span>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-4 leading-5 text-muted">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.suggested_drills && analysis.suggested_drills.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">建议巩固练习</span>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-4 leading-5 text-muted">
                {analysis.suggested_drills.map((d, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{d.focus_tag}</span>（{d.recommended_level}）：{d.goal}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
