"use client";

// 用户的常用语言（一个或几个，第一个是默认语言）。题解、演示里的代码、专题都按它显示。
// 没登录：存在浏览器里。登录并开通了进度仓：以进度仓的 settings.json 为准，改动会写回去，换设备也跟着账号走。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_LANGS, cleanLangs } from "@/lib/langs";
import { useProgress } from "@/lib/progress";

interface Ctx {
  /** 常用语言，第一个是默认语言 */
  langs: string[];
  setLangs: (langs: string[]) => void;
  /** 正在把设置写进进度仓 */
  saving: boolean;
  error: string | null;
  /** 设置存在哪：进度仓，还是这个浏览器 */
  where: "repo" | "browser";
}

const PrefsCtx = createContext<Ctx | null>(null);
const KEY = "hot100:langs";
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const { ready, progress } = useProgress();
  const [langs, setState] = useState<string[]>(DEFAULT_LANGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 先用浏览器里存的
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setState(cleanLangs(JSON.parse(s)));
    } catch { /* 读不了就用默认的 */ }
    setLoaded(true);
  }, []);

  const save = useCallback(async (next: string[]) => {
    setSaving(true);
    try {
      const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ langs: next }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || `保存失败（${r.status}）`);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, []);

  // 登录后：进度仓里有设置就用它；没有而浏览器里选过，就把浏览器里的写进进度仓（只做一次）
  const synced = useRef(false);
  const repoLangs = progress?.settings?.langs;
  useEffect(() => {
    if (!ready || !loaded || synced.current) return;
    synced.current = true;
    if (repoLangs) {
      const next = cleanLangs(repoLangs);
      setState(next);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 存不了也没关系 */ }
    } else if (!same(langs, DEFAULT_LANGS)) save(langs);
  }, [ready, loaded, repoLangs, langs, save]);
  useEffect(() => { if (!ready) synced.current = false; }, [ready]); // 退出登录后，下次登录重新对一遍

  // 连着点几下（勾选、改默认）只往进度仓写一次：停手一秒多再写，免得进度仓里多出一串提交
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setLangs = useCallback((next: string[]) => {
    const clean = cleanLangs(next);
    setState(clean);
    try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* 存不了就只在这次访问里生效 */ }
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; save(clean); }, 1200);
  }, [ready, save]);

  const value = useMemo<Ctx>(() => ({ langs, setLangs, saving, error, where: ready ? "repo" : "browser" }), [langs, setLangs, saving, error, ready]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error("usePrefs 要放在 PrefsProvider 里面用");
  return c;
}
