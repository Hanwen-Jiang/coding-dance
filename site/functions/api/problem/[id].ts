import { edgeCached } from "../../_lib/edge-cache";
import type { Env } from "../../_lib/github";
import { fail, json } from "../../_lib/github";
import { loadProblem } from "../../_lib/repo";

type Ctx = { request: Request; env: Env; params: { id: string }; waitUntil: (p: Promise<unknown>) => void };

export const onRequestGet = edgeCached(async ({ env, params }: Ctx) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "题号不对" }, 400);
  try {
    return json(await loadProblem(env, id));
  } catch (e) {
    return fail(e);
  }
});
