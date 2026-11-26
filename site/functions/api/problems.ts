import { edgeCached } from "../_lib/edge-cache.ts";
import type { Env } from "../_lib/github.ts";
import { fail, json } from "../_lib/github.ts";
import { loadIndex } from "../_lib/repo.ts";

type Ctx = { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void };

export const onRequestGet = edgeCached(async ({ request, env }: Ctx) => {
  try {
    const { problems, topics } = await loadIndex(env, request.url);
    return json({ problems, topics });
  } catch (e) {
    return fail(e);
  }
});
