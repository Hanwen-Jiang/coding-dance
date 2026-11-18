// 用户有没有把网站的 GitHub App 授权到自己账号上（GitHub 管这个叫「安装」），授权范围包不包括某个仓库，以及用它建进度仓。
import { HttpError } from "./github";
import { gh } from "./progress";

export interface Installation {
  id: number;
  /** all：全部仓库；selected：只选了几个仓库 */
  selection: "all" | "selected";
  /** 这次授权带不带「建仓库」的权限（App 后来才加的权限，老的授权要用户同意之后才有） */
  canCreate: boolean;
  /** 第一次授权的时间（判断是不是首批用户用） */
  createdAt: string | null;
}

/** 当前用户在自己账号上的授权；没有返回 null */
export async function userInstallation(token: string, login: string): Promise<Installation | null> {
  const r = await gh(token, "GET", "/user/installations?per_page=100");
  if (!r.ok) return null;
  const j = (await r.json()) as { installations?: { id: number; account?: { login?: string }; repository_selection?: string; permissions?: Record<string, string>; created_at?: string }[] };
  const inst = (j.installations || []).find((i) => (i.account?.login || "").toLowerCase() === login.toLowerCase());
  if (!inst) return null;
  return { id: inst.id, selection: inst.repository_selection === "all" ? "all" : "selected", canCreate: inst.permissions?.repository_creation === "write", createdAt: inst.created_at || null };
}

/** 授权范围里有没有这个仓库（owner/name） */
export async function installationCovers(token: string, inst: Installation, repo: string): Promise<boolean> {
  for (let page = 1; page <= 5; page++) {
    const r = await gh(token, "GET", `/user/installations/${inst.id}/repositories?per_page=100&page=${page}`);
    if (!r.ok) return false;
    const j = (await r.json()) as { repositories: { full_name: string }[] };
    if (j.repositories.some((x) => x.full_name.toLowerCase() === repo.toLowerCase())) return true;
    if (j.repositories.length < 100) return false;
  }
  return false;
}

/**
 * 用模板在用户自己的账号下建进度仓。要求用户已经授权，并且授权里带「建仓库」的权限；
 * 建出来的仓库 GitHub 会自动放进这次授权的范围里。
 */
export async function createFromTemplate(token: string, template: string, owner: string, name: string, isPrivate: boolean): Promise<void> {
  const r = await gh(token, "POST", `/repos/${template}/generate`, {
    owner, name, private: isPrivate, include_all_branches: false,
    description: "力扣热题 100：我的进度、题解和尝试记录",
  });
  if (r.status === 201) return;
  const j = (await r.json().catch(() => ({}))) as { message?: string; errors?: unknown };
  const msg = `${j.message || ""} ${JSON.stringify(j.errors || "")}`;
  if (r.status === 422 && /exist/i.test(msg)) throw new HttpError(409, `你的账号下已经有 ${name} 这个仓库了`);
  if (r.status === 403 || r.status === 404) throw new HttpError(403, "GitHub 没让网站替你建仓库：这次授权里没有建仓库的权限");
  throw new HttpError(502, `建仓库失败（GitHub ${r.status}${j.message ? "：" + j.message : ""}）`);
}
