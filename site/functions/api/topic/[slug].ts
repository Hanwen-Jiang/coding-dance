import { edgeCached } from "../../_lib/edge-cache.ts";
import type { Env } from "../../_lib/github.ts";
import { fail, json } from "../../_lib/github.ts";
import { loadTopic } from "../../_lib/repo.ts";

type Ctx = { request: Request; env: Env; params: { slug: string }; waitUntil: (p: Promise<unknown>) => void };

/** 一个基础专题的内容 */
export const onRequestGet = edgeCached(async ({ request, env, params }: Ctx) => {
  const slug = String(params.slug);
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: "专题名不对" }, 400);
  try {
    return json(await loadTopic(env, slug, request.url));
  } catch (e) {
    return fail(e);
  }
});
