"use client";

// 当前用户的登录状态和进度。题目资源对所有人都一样；进度来自用户自己的 hot100-progress 仓库，没登录时就是 0 进度。
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { ProgressData, SessionInfo, StarResult, Status } from "@/lib/types";

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
  /** 给用户勾选的仓库点 Star，返回每个仓库的结果（没点上的带着 GitHub 的状态码） */
  star: (repos: string[]) => Promise<StarResult[]>;
  /** 在网页里直接建进度仓（要先授权）。成功返回 null；失败返回原因，code 是 exists / forbidden / failed */
  createRepo: (isPrivate: boolean) => Promise<{ code: string; error: string } | null>;
  /** 重新确认登录状态（建完仓库后点「刷新」用） */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  loginHref: () => string;
  installHref: () => string;
  /** 能读写进度仓：登录了、仓库建好了、App 也装到仓库上了 */
  ready: boolean;
}

const ProgressCtx = createContext<Ctx | null>(null);

/** 另一个域名连不连得上（3 秒内能拿到它的图标就算）。no-cors 拿不到内容，只看请求有没有失败 */
async function reachable(origin: string): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3000);
  try {
    await fetch(`${origin}/favicon.svg`, { mode: "no-cors", cache: "no-store", signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

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
      setProgress(s.user && s.repo?.exists && s.repo.accessible ? await getJson<ProgressData>("/api/progress") : null);
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

  // 以前只在登录域名上登录过：把登录同步到网站的其余域名（只补这一次）。先测哪些域名连得上，连不上的跳过，免得卡在打不开的页面上
  const spread = session?.spread;
  useEffect(() => {
    if (!spread?.length) return;
    let gone = false;
    (async () => {
      const ok = await Promise.all(spread.map((o) => reachable(o)));
      if (gone) return;
      const to = spread.filter((_, i) => ok[i]);
      const back = location.pathname + location.search + location.hash;
      location.replace(`/api/auth/spread?to=${encodeURIComponent(to.join(","))}&return=${encodeURIComponent(back)}`);
    })();
    return () => { gone = true; };
  }, [spread]);

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

  const star = useCallback(async (repos: string[]): Promise<StarResult[]> => {
    if (!repos.length) return [];
    try {
      // keepalive：点完马上跳去 GitHub 时，浏览器也不会取消这个请求
      const { results } = await getJson<{ results: StarResult[] }>("/api/progress/star", {
        method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repos }),
      });
      setSession((s) => {
        if (!s) return s;
        const stars = s.stars.map((x) => (results.some((r) => r.repo === x.repo && r.starred) ? { ...x, starred: true } : x));
        return { ...s, stars, starred: stars.every((x) => x.starred) };
      });
      return results;
    } catch {
      return repos.map((repo) => ({ repo, starred: false, status: 0 })); // Star 失败不影响别的
    }
  }, []);

  const createRepo = useCallback(async (isPrivate: boolean) => {
    try {
      const r = await fetch("/api/progress/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ private: isPrivate }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!r.ok) return { code: j.code || "failed", error: j.error || `请求失败（${r.status}）` };
    } catch (e) {
      return { code: "failed", error: (e as Error).message };
    }
    // GitHub 建仓库、把它放进授权范围要一小会儿：等到网站能读写它为止（最多十几秒）
    for (let k = 0; k < 12; k++) {
      await new Promise((r) => setTimeout(r, k < 3 ? 800 : 1500));
      try {
        const s = await getJson<SessionInfo>("/api/session");
        if (s.repo?.exists && s.repo.accessible) break;
      } catch { /* 这一次没问到，接着等 */ }
    }
    await load();
    return null;
  }, [load]);

  const logout = useCallback(async () => {
    const back = location.pathname + location.search + location.hash;
    const r = await fetch(`/api/auth/logout?return=${encodeURIComponent(back)}`, { method: "POST" });
    // 网站有几个域名时，顺路把其余域名的登录也清掉，最后回到这一页
    const j = (await r.json().catch(() => ({}))) as { next?: string };
    if (j.next) {
      location.assign(j.next);
      return;
    }
    setProgress(null);
    await load();
  }, [load]);

  const here = () => encodeURIComponent(typeof window === "undefined" ? "/" : location.pathname + location.search);
  const loginHref = useCallback(() => `/api/auth/login?return=${here()}`, []);
  const installHref = useCallback(() => `/api/auth/install?return=${here()}`, []);
  const ready = !!(session?.user && session.repo?.exists && session.repo.accessible && progress);

  const value = useMemo(
    () => ({ loading, session, progress, saving, error, statusOf, langsOf, setStatus, star, createRepo, refresh: load, logout, loginHref, installHref, ready }),
    [loading, session, progress, saving, error, statusOf, langsOf, setStatus, star, createRepo, load, logout, loginHref, installHref, ready],
  );
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx);
  if (!c) throw new Error("useProgress 要放在 ProgressProvider 里面用");
  return c;
}
