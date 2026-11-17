// 退出时顺路清掉这个域名的会话（见 _lib/sso.ts）
import type { AuthEnv } from "../../_lib/session";
import { onSignout } from "../../_lib/sso";

export const onRequestGet = ({ request, env }: { request: Request; env: AuthEnv }) => onSignout(request, env);
