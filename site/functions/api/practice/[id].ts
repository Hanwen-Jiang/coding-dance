// 一道题的练习数据（力扣模式和 ACM 模式的模板、ACM 题面、练习用例）。
// 优先经 3 级内容寻址清单读取（R2 CDN -> Pages 静态 ASSETS /_r2 -> GitHub 仓库回退），由 cd-build 生成并打包。
import { edgeCached } from "../../_lib/edge-cache.ts";
import type { Env } from "../../_lib/github.ts";
import { fail, json, readText } from "../../_lib/github.ts";
import { readR2Practice } from "../../_lib/r2.ts";

type Ctx = { request: Request; env: Env; params: { id: string }; waitUntil: (p: Promise<unknown>) => void };

export const onRequestGet = edgeCached(async ({ request, env, params }: Ctx) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0 || id > 9999) return json({ error: "题号不对" }, 400);
  const pad4 = String(id).padStart(4, "0");
  try {
    const text = (await readR2Practice(env, pad4, request.url)) ?? (await readText(env, `tools/practice/data/${pad4}.json`));
    if (!text) return json({ error: "这道题还没有练习数据" }, 404);
    return new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=30" } });
  } catch (e) {
    return fail(e);
  }
});
