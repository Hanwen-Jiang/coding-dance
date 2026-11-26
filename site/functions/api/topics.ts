import { edgeCached } from "../_lib/edge-cache.ts";
import type { Env } from "../_lib/github.ts";
import { fail, json } from "../_lib/github.ts";
import { loadTopics } from "../_lib/repo.ts";

type Ctx = { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void };

/** 基础专题的目录 */
export const onRequestGet = edgeCached(async ({ request, env }: Ctx) => {
  try {
    return json({ topics: await loadTopics(env, request.url) });
  } catch (e) {
    return fail(e);
  }
});
