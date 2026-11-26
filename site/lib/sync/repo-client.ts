// 同步页在浏览器里用的进度仓接口：请求本站的 /api/sync/*，由服务端用用户自己的 GitHub 登录代办。
import { API_BASE, apiFetch } from "../api-base.ts";
import { ConflictError, type RepoClient } from "./plan.ts";

async function call(path: string, init?: RequestInit) {
  const r = await apiFetch(path, { credentials: API_BASE ? "include" : "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 409 && path.endsWith("/commit")) throw new ConflictError("仓库在这期间有了新的提交");
  if (!r.ok) throw new Error(j.error || `请求失败（${r.status}）`);
  return j;
}

export function createRepoClient(): RepoClient {
  return {
    head: () => call("/api/sync/repo"),
    async texts(shas) {
      const out: Record<string, string> = {};
      for (let k = 0; k < shas.length; k += 50) Object.assign(out, (await call("/api/sync/blobs", { method: "POST", body: JSON.stringify({ shas: shas.slice(k, k + 50) }) })).texts);
      return out;
    },
    commit: (args) => call("/api/sync/commit", { method: "POST", body: JSON.stringify(args) }),
  };
}
