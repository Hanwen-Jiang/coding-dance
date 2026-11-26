// 登录：跳到 GitHub App 的授权页。GitHub App 的权限在 App 设置里定好了（进度仓 Contents 读写、Starring），这里不传 scope。
// 有几个域名时（SITE_ORIGINS），只有登录域名去 GitHub，别的域名先跳到登录域名（见 _lib/sso.ts）。
import { type AuthEnv, authConfigured, privateJson } from "../../_lib/session";
import { authEntry } from "../../_lib/sso";

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!authConfigured(env)) return privateJson({ error: "GitHub 登录还没有配置" }, 503);
  return authEntry(request, env, "login");
};
