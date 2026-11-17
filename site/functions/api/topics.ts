import type { Env } from "../_lib/github";
import { fail, json } from "../_lib/github";
import { loadTopics } from "../_lib/repo";

/** 基础专题的目录 */
export const onRequestGet = async ({ env }: { env: Env }) => {
  try {
    return json({ topics: await loadTopics(env) });
  } catch (e) {
    return fail(e);
  }
};
