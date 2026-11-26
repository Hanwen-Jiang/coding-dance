import { companionConfigured } from "../../_lib/companion.ts";
import { llmConfigured, type CoachLlmEnv } from "../../_lib/companion-coach.ts";
import { clean, getSession, privateJson, type AuthEnv } from "../../_lib/session.ts";

type Env = AuthEnv & CoachLlmEnv & { CODING_AGENT_URL?: string; CODING_DANCE_API_TOKEN?: string };

async function upstreamLlmEnabled(env: Env): Promise<boolean> {
  const base = clean(env.CODING_AGENT_URL);
  const token = clean(env.CODING_DANCE_API_TOKEN);
  if (!base || !token) return false;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/integrations/coding-dance/v1/status`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Mozilla/5.0 (compatible; CodingDanceCompanion/1.0)",
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { llm_enabled?: boolean } | null;
    return data?.llm_enabled === true;
  } catch {
    return false;
  }
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const { session, cookie } = await getSession(request, env).catch(() => ({ session: null, cookie: null }));
  const llmEnabled = llmConfigured(env) || (await upstreamLlmEnabled(env));
  return privateJson(
    { available: companionConfigured(env), authenticated: !!session, llmEnabled },
    200,
    [cookie],
  );
};
