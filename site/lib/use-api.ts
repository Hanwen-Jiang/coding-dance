"use client";

import { useEffect, useState } from "react";

type State<T> = { data: T | null; error: string | null; loading: boolean };

const mem = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

/**
 * 不在组件里、按需读一次（比如首页进度格子的预览）：和 useApi 共用缓存，预览过的题点进去不用再等。
 * 同一个地址同时只发一个请求。
 */
export function fetchApi<T>(url: string): Promise<T> {
  if (mem.has(url)) return Promise.resolve(mem.get(url) as T);
  let p = pending.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url)
      .then(async (r) => {
        const j = await r.json().catch(() => ({ error: `请求失败（${r.status}）` }));
        if (!r.ok) throw new Error(j.error || `请求失败（${r.status}）`);
        mem.set(url, j);
        return j as T;
      })
      .finally(() => pending.delete(url));
    pending.set(url, p);
  }
  return p;
}

/** 读 /api 下的 JSON。同一个页面会话里读过的直接复用，切回列表页不用重新等。 */
export function useApi<T>(url: string): State<T> {
  const [state, setState] = useState<State<T>>(() => {
    const hit = mem.get(url) as T | undefined;
    return { data: hit ?? null, error: null, loading: !hit };
  });

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(async (r) => {
        const j = await r.json().catch(() => ({ error: `请求失败（${r.status}）` }));
        if (!r.ok) throw new Error(j.error || `请求失败（${r.status}）`);
        return j as T;
      })
      .then((data) => {
        mem.set(url, data);
        if (alive) setState({ data, error: null, loading: false });
      })
      .catch((e: Error) => alive && setState((s) => ({ data: s.data, error: e.message, loading: false })));
    return () => {
      alive = false;
    };
  }, [url]);

  return state;
}
