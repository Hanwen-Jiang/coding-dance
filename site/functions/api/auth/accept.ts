// 核对登录域名开的票据，写当前域名的会话，再去下一个域名（见 _lib/sso.ts）
import type { AuthEnv } from "../../_lib/session";
import { onAccept } from "../../_lib/sso";

export const onRequestGet = ({ request, env }: { request: Request; env: AuthEnv }) => onAccept(request, env);
