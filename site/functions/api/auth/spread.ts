// 以前只在登录域名上登录过的会话，补着同步到其余域名（见 _lib/sso.ts）
import type { AuthEnv } from "../../_lib/session";
import { onSpread } from "../../_lib/sso";

export const onRequestGet = ({ request, env }: { request: Request; env: AuthEnv }) => onSpread(request, env);
