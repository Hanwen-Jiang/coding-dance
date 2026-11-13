import type { Env } from "../_lib/github";
import { fail, json } from "../_lib/github";
import { loadIndex } from "../_lib/repo";

export const onRequestGet = async ({ env }: { env: Env }) => {
  try {
    const { problems, topics } = await loadIndex(env);
    return json({ problems, topics });
  } catch (e) {
    return fail(e);
  }
};
