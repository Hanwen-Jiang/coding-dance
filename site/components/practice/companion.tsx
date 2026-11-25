"use client";

import { Button, Chip, Spinner } from "@heroui/react";
import clsx from "clsx";
import { useState } from "react";

import {
  type CompanionConsentMode,
  type CompanionHintLevel,
  HINT_LEVEL_META,
  type HintCheckResponse,
  type HintRevealResponse,
  type HistoryAnalyzeResponse,
  analyzeCompanionHistory,
  attemptsToSubmissions,
} from "@/lib/companion";
import type { Attempt } from "@/lib/types";

const NEXT_LEVEL: Partial<Record<CompanionHintLevel, CompanionHintLevel>> = {
  L1: "L2",
  L2: "L3",
  L3: "L4",
};

/** Spoiler-free proactive prompt banner shown in PracticeSession's notice slot. */
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
      <span className="min-w-0 flex-1 text-xs leading-5">
        {prompt.prompt_text || "检测到连续受阻，需要一条不剧透的方向提问吗？"}
      </span>
      <Button
        className="practice-tb-btn"
        isDisabled={loading}
        onPress={() => onAccept(recommended)}
        size="sm"
        variant="secondary"
      >
        {loading ? "生成中…" : `查看 ${recommended} 引导`}
      </Button>
      <Button className="practice-tb-btn" isDisabled={loading} onPress={onDismiss} size="sm" variant="ghost">
        暂不需要
      </Button>
    </div>
  );
}

/** Consent-First L1-L4 progressive coaching tab inside the practice console. */
export function PracticeCompanionPanel({
  consentMode,
  selectedLevel,
  revealed,
  loading,
  error,
  onSelectLevel,
  onRequestHint,
}: {
  consentMode: CompanionConsentMode;
  selectedLevel: CompanionHintLevel;
  revealed: HintRevealResponse | null;
  loading: boolean;
  error: string | null;
  onSelectLevel: (level: CompanionHintLevel) => void;
  onRequestHint: (level: CompanionHintLevel) => void;
}) {
  const activeLevel = revealed?.hint_level ?? selectedLevel;
  const meta = HINT_LEVEL_META.find((m) => m.id === selectedLevel) ?? HINT_LEVEL_META[0];
  const nextLevel = NEXT_LEVEL[activeLevel];

  return (
    <div className="flex flex-col gap-3" data-testid="practice-companion-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="渐进提示层级">
          {HINT_LEVEL_META.map((item) => (
            <button
              aria-pressed={selectedLevel === item.id}
              className={clsx(
                "rounded-md border px-2 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                selectedLevel === item.id
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-border text-muted hover:text-foreground",
              )}
              key={item.id}
              onClick={() => onSelectLevel(item.id)}
              title={item.desc}
              type="button"
            >
              {item.short}
            </button>
          ))}
        </div>
        <Chip size="sm" variant="soft">
          {consentMode === "proactive_consent" ? "主动询问（不剧透）" : "仅按需提示"}
        </Chip>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs leading-5 text-danger" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2.5 py-3 text-xs text-muted" role="status">
          <Spinner size="sm" />
          <span>正在结合当前代码与报错生成 {selectedLevel} 提示…</span>
        </div>
      )}

      {!loading && (!revealed || revealed.hint_level !== selectedLevel) && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-foreground/[0.02] p-3">
          <p className="text-xs leading-5 text-muted">
            <span className="font-medium text-foreground">{meta.label}：</span>
            {meta.desc}（仅在点击确认后展示内容）
          </p>
          <Button
            className="practice-tb-btn"
            onPress={() => onRequestHint(selectedLevel)}
            size="sm"
            variant="primary"
          >
            确认获取 {selectedLevel} 提示
          </Button>
        </div>
      )}

      {!loading && revealed && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-foreground/[0.02] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">{revealed.title}</span>
            <Chip color="accent" size="sm" variant="soft">
              {revealed.hint_level}
            </Chip>
          </div>
          <p className="whitespace-pre-wrap text-xs leading-6 text-foreground">{revealed.hint}</p>
          {revealed.next_steps && revealed.next_steps.length > 0 && (
            <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-muted">
              {revealed.next_steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          )}
          {nextLevel && revealed.hint_level === selectedLevel && (
            <div className="flex justify-end pt-1">
              <Button
                className="practice-tb-btn"
                onPress={() => {
                  onSelectLevel(nextLevel);
                  onRequestHint(nextLevel);
                }}
                size="sm"
                variant="secondary"
              >
                还不够清晰，再深一层（{nextLevel}）
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** On-demand AI history review card inside ProblemView's AttemptList. */
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
        <span className="text-xs text-muted">结合本站与力扣尝试记录生成薄弱点诊断与巩固建议（仅在点击时触发）。</span>
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
