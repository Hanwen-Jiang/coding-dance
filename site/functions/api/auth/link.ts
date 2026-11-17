// 跨域名同步登录的第一站：在当前域名记下随机数，带着它去登录域名领票据（见 _lib/sso.ts）
import type { AuthEnv } from "../../_lib/session";
import { onLink } from "../../_lib/sso";

export const onRequestGet = ({ request, env }: { request: Request; env: AuthEnv }) => onLink(request, env);
