"use client";

// 当前用户的登录状态和进度。题目资源对所有人都一样；进度来自用户自己的 hot100-progress 仓库，没登录时就是 0 进度。
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { ProgressData, SessionInfo, Status } from "@/lib/types";

interface Ctx {
  /** 还在确认登录状态 */
  loading: boolean;
  session: SessionInfo | null;
  progress: ProgressData | null;
  /** 正在保存状态的题号 */
  saving: number | null;
  error: string | null;
  statusOf: (id: number) => Status;
  langsOf: (id: number) => string[];
  setStatus: (id: number, s: Status) => Promise<void>;
  setup: (star: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loginHref: () => string;
}

const ProgressCtx = createContext<Ctx | null>(null);

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || `请求失败（${r.status}）`);
  return j as T;
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getJson<SessionInfo>("/api/session");
      setSession(s);
      setProgress(s.user && s.repo?.exists ? await getJson<ProgressData>("/api/progress") : null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusOf = useCallback((id: number) => progress?.status[String(id)] ?? "未开始", [progress]);
  const langsOf = useCallback((id: number) => progress?.langs[String(id)] ?? [], [progress]);

  const setStatus = useCallback(async (id: number, s: Status) => {
    if (!progress) return;
    const before = progress;
    const next = { ...progress.status };
    if (s === "未开始") delete next[String(id)];
    else next[String(id)] = s;
    setProgress({ ...progress, status: next }); // 先在界面上改掉，再提交到进度仓
    setSaving(id);
    try {
      setProgress(await getJson<ProgressData>("/api/progress", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: s }) }));
      setError(null);
    } catch (e) {
      setProgress(before);
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }, [progress]);

  const setup = useCallback(async (star: boolean) => {
    await getJson("/api/progress/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ star }) });
    // GitHub 用模板生成仓库要一两秒，等它能读了再刷新
    for (let k = 0; k < 8; k++) {
      await new Promise((r) => setTimeout(r, 900));
      try {
        const p = await getJson<ProgressData>("/api/progress");
        setProgress(p);
        break;
      } catch {
        /* 还没好，继续等 */
      }
    }
    await load();
  }, [load]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setProgress(null);
    await load();
  }, [load]);

  const loginHref = useCallback(() => `/api/auth/login?return=${encodeURIComponent(typeof window === "undefined" ? "/" : location.pathname + location.search)}`, []);

  const value = useMemo(
    () => ({ loading, session, progress, saving, error, statusOf, langsOf, setStatus, setup, logout, loginHref }),
    [loading, session, progress, saving, error, statusOf, langsOf, setStatus, setup, logout, loginHref],
  );
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx);
  if (!c) throw new Error("useProgress 要放在 ProgressProvider 里面用");
  return c;
}
