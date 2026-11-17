import { edgeCached } from "../_lib/edge-cache";
import type { Env } from "../_lib/github";
import { fail, json } from "../_lib/github";
import { loadIndex } from "../_lib/repo";

type Ctx = { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void };

export const onRequestGet = edgeCached(async ({ env }: Ctx) => {
  try {
    const { problems, topics } = await loadIndex(env);
    return json({ problems, topics });
  } catch (e) {
    return fail(e);
  }
});
