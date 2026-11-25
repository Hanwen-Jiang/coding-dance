import { companionConfigured } from "../../_lib/companion.ts";
import { getSession, privateJson, type AuthEnv } from "../../_lib/session.ts";

type Env = AuthEnv & { CODING_AGENT_URL?: string; CODING_DANCE_API_TOKEN?: string };

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const { session, cookie } = await getSession(request, env).catch(() => ({ session: null, cookie: null }));
  return privateJson({ available: companionConfigured(env), authenticated: !!session }, 200, [cookie]);
};
