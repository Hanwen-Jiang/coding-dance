// 退出：清掉当前域名的会话；有几个域名时返回 next，页面跳过去把其余域名的会话也清掉（见 _lib/sso.ts）
import type { AuthEnv } from "../../_lib/session";
import { onLogout } from "../../_lib/sso";

export const onRequestPost = ({ request, env }: { request: Request; env: AuthEnv }) => onLogout(request, env);
