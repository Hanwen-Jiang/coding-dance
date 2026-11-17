import { edgeCached } from "../../_lib/edge-cache";
import type { Env } from "../../_lib/github";
import { fail, json } from "../../_lib/github";
import { loadTopic } from "../../_lib/repo";

type Ctx = { request: Request; env: Env; params: { slug: string }; waitUntil: (p: Promise<unknown>) => void };

/** 一个基础专题的内容 */
export const onRequestGet = edgeCached(async ({ env, params }: Ctx) => {
  const slug = String(params.slug);
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: "专题名不对" }, 400);
  try {
    return json(await loadTopic(env, slug));
  } catch (e) {
    return fail(e);
  }
});
