"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-base";
import type { Attempt } from "@/lib/types";

export type CompanionConsentMode = "proactive_consent" | "on_demand" | "off";
export type CompanionHintLevel = "L1" | "L2" | "L3" | "L4";

export const COMPANION_MODE_KEY = "hot100:companion:mode";
const MODE_EVENT = "hot100:companion-mode";

export const COMPANION_MODES: { id: CompanionConsentMode; label: string; desc: string }[] = [
  { id: "proactive_consent", label: "主动询问", desc: "连续卡住时先征询，同意后才给提示" },
  { id: "on_demand", label: "仅按需点击", desc: "不主动打扰，点「伴学」再看" },
  { id: "off", label: "静默关闭", desc: "隐藏伴学提示并阻止后台分析" },
];

export const HINT_LEVEL_META: { id: CompanionHintLevel; label: string; short: string; desc: string }[] = [
  { id: "L1", label: "L1 方向提问", short: "L1 方向", desc: "提出 1～2 个关键思考方向，不点破结构与代码" },
  { id: "L2", label: "L2 边界线索", short: "L2 边界", desc: "指出关键不变量与容易遗漏的边界条件，不给代码" },
  { id: "L3", label: "L3 结构骨架", short: "L3 骨架", desc: "提供关键步骤伪代码与复杂度边界" },
  { id: "L4", label: "L4 完整排查", short: "L4 完整", desc: "给出完整根因分析、优化思路与边界测试建议" },
];

export function isCompanionMode(v: unknown): v is CompanionConsentMode {
  return v === "proactive_consent" || v === "on_demand" || v === "off";
}

export function readCompanionMode(): CompanionConsentMode {
  try {
    const v = localStorage.getItem(COMPANION_MODE_KEY);
    if (isCompanionMode(v)) return v;
  } catch { /* 浏览器存储不可用时退回默认 */ }
  return "proactive_consent";
}

export function writeCompanionMode(next: CompanionConsentMode) {
  try {
    localStorage.setItem(COMPANION_MODE_KEY, next);
  } catch { /* ignore */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: next }));
  }
}

export function useCompanionMode(): [CompanionConsentMode, (next: CompanionConsentMode) => void] {
  const [mode, setMode] = useState<CompanionConsentMode>("proactive_consent");
  useEffect(() => {
    setMode(readCompanionMode());
    const onSync = (e: Event) => {
      const val = (e as CustomEvent<unknown>).detail;
      if (isCompanionMode(val)) setMode(val);
      else setMode(readCompanionMode());
    };
    window.addEventListener(MODE_EVENT, onSync);
    return () => window.removeEventListener(MODE_EVENT, onSync);
  }, []);
  const update = useCallback((next: CompanionConsentMode) => {
    setMode(next);
    writeCompanionMode(next);
  }, []);
  return [mode, update];
}

export interface HintCheckResponse {
  consent_mode: CompanionConsentMode;
  action: "silent" | "standby" | "none" | "ask_consent";
  should_prompt: boolean;
  prompt_text?: string;
  consent_token?: string;
  recommended_level?: CompanionHintLevel;
  available_levels?: CompanionHintLevel[];
  spoiler_free?: boolean;
}

export interface HintRevealResponse {
  hint_level: CompanionHintLevel;
  source: string;
  title: string;
  hint: string;
  next_steps?: string[];
  runtime_task_id?: string;
}

export interface HistoryAnalyzeResponse {
  summary: {
    total_submissions: number;
    accepted: number;
    pass_rate: number;
    avg_runtime_ms?: number;
    error_breakdown?: Record<string, number>;
  };
  weak_tags?: { tag: string; failures: number }[];
  recommendations: string[];
  suggested_drills?: { focus_tag: string; goal: string; recommended_level: CompanionHintLevel }[];
}

async function postCompanion<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `伴学请求失败（HTTP ${res.status}）`);
  }
  return data;
}

export const checkCompanionHint = (payload: {
  consent_mode: CompanionConsentMode;
  problem_id: string;
  problem_title: string;
  language: string;
  stuck_seconds: number;
  attempt_count: number;
  error_output?: string;
  failed_tests?: number;
}) => postCompanion<HintCheckResponse>("/api/companion/hint-check", { ...payload, locale: "zh" });

export const revealCompanionHint = (payload: {
  consent_mode: CompanionConsentMode;
  user_consented: true;
  consent_token?: string;
  hint_level: CompanionHintLevel;
  problem_id: string;
  problem_title: string;
  language: string;
  code: string;
  error_output?: string;
  mode?: "fast" | "runtime";
}) => postCompanion<HintRevealResponse>("/api/companion/hint-reveal", { ...payload, locale: "zh" });

export const analyzeCompanionHistory = (payload: {
  consent_mode: CompanionConsentMode;
  user_consented: true;
  submissions: { problem_id: string; status: string; error_type?: string; tags?: string[] }[];
}) => postCompanion<HistoryAnalyzeResponse>("/api/companion/history-analyze", { ...payload, locale: "zh" });

const RESULT_STATUS_MAP: Record<string, { status: string; errorType?: string }> = {
  通过: { status: "accepted" },
  答案错误: { status: "wrong_answer", errorType: "wrong_answer" },
  超时: { status: "wrong_answer", errorType: "tle" },
  运行出错: { status: "wrong_answer", errorType: "runtime_error" },
  思路不成立: { status: "wrong_answer", errorType: "approach_blocked" },
};

export function attemptsToSubmissions(attempts: Attempt[], topic: string) {
  return attempts.map((a, idx) => {
    const mapped = RESULT_STATUS_MAP[a.result] ?? { status: "wrong_answer", errorType: a.result };
    return {
      problem_id: `${a.file}#${idx}`,
      status: mapped.status,
      ...(mapped.errorType ? { error_type: mapped.errorType } : {}),
      tags: topic ? [topic, a.lang] : [a.lang],
    };
  });
}
