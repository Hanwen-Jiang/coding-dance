// 登录域名：有会话就给发起的域名开一次性票据，没有就去 GitHub（见 _lib/sso.ts）
import type { AuthEnv } from "../../_lib/session";
import { onBridge } from "../../_lib/sso";

export const onRequestGet = ({ request, env }: { request: Request; env: AuthEnv }) => onBridge(request, env);
