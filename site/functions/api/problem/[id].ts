import { edgeCached } from "../../_lib/edge-cache.ts";
import type { Env } from "../../_lib/github.ts";
import { fail, json } from "../../_lib/github.ts";
import { loadProblem } from "../../_lib/repo.ts";

type Ctx = { request: Request; env: Env; params: { id: string }; waitUntil: (p: Promise<unknown>) => void };

export const onRequestGet = edgeCached(async ({ request, env, params }: Ctx) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "题号不对" }, 400);
  try {
    return json(await loadProblem(env, id, request.url));
  } catch (e) {
    return fail(e);
  }
});
