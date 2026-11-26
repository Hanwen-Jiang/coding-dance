import { edgeCached } from "../_lib/edge-cache";
import type { Env } from "../_lib/github";
import { fail, json } from "../_lib/github";
import { loadTopics } from "../_lib/repo";

type Ctx = { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void };

/** 基础专题的目录 */
export const onRequestGet = edgeCached(async ({ env }: Ctx) => {
  try {
    return json({ topics: await loadTopics(env) });
  } catch (e) {
    return fail(e);
  }
});
