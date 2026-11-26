// 授权：跳到 GitHub App 的授权页（GitHub 管它叫「安装」），让用户选授权范围。
// App 开了「安装时请求用户授权」，授权完 GitHub 会带着授权码回到登录域名的 /api/auth/callback，顺便完成登录。
import { type AuthEnv, authConfigured, privateJson } from "../../_lib/session";
import { authEntry } from "../../_lib/sso";

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!authConfigured(env)) return privateJson({ error: "GitHub App 还没有配置" }, 503);
  return authEntry(request, env, "install");
};
