// 一道题的练习数据（力扣模式和 ACM 模式的模板、ACM 题面、练习用例）。
// 数据在资源仓的 tools/practice/data/<四位编号>.json，由 tools/practice/build.cjs 生成；和其他题目资源一样运行时从仓库读，push 后一分钟内生效。
import type { Env } from "../../_lib/github";
import { fail, json, readText } from "../../_lib/github";

export const onRequestGet = async ({ env, params }: { env: Env; params: { id: string } }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0 || id > 9999) return json({ error: "题号不对" }, 400);
  try {
    const text = await readText(env, `tools/practice/data/${String(id).padStart(4, "0")}.json`);
    if (!text) return json({ error: "这道题还没有练习数据" }, 404);
    return new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=30" } });
  } catch (e) {
    return fail(e);
  }
};
