"use client";

import { useEffect, useState } from "react";

type State<T> = { data: T | null; error: string | null; loading: boolean };

const mem = new Map<string, unknown>();

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
