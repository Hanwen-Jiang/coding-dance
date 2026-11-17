// 只代理题目图片和图解页面，不把整个仓库暴露出去
import { edgeCached } from "../../_lib/edge-cache";
import type { Env } from "../../_lib/github";
import { fail, json, readBytes } from "../../_lib/github";

type Ctx = { request: Request; env: Env; params: { path?: string | string[] }; waitUntil: (p: Promise<unknown>) => void };

const ALLOWED = ["problems/images/", "illustrations/"];
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  html: "text/html; charset=utf-8",
};

export const onRequestGet = edgeCached(async ({ env, params }: Ctx) => {
  const dec = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const segs = (Array.isArray(params.path) ? params.path : params.path ? [params.path] : []).map(dec);
  const path = segs.join("/");
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (segs.some((s) => s === ".." || s === "") || !ALLOWED.some((p) => path.startsWith(p)) || !TYPES[ext]) {
    return json({ error: "不允许访问这个路径" }, 403);
  }
  try {
    const body = await readBytes(env, path);
    if (!body) return json({ error: "文件不存在" }, 404);
    return new Response(body, {
      headers: { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    return fail(e);
  }
});
