// 统一 BFF 接口基址：默认走同源 /api/*（由 Cloudflare Pages Edge BFF 代理至 cd-api）；
// 若构建期注入 NEXT_PUBLIC_API_BASE_URL（如 https://api.codingdance.cn），则跨域直连统一 Go BFF 并携带 Cookie。
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!API_BASE) return fetch(path, init);
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: init?.credentials ?? "include",
  });
}
