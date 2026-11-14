import { SESSION_COOKIE, privateJson, sameOrigin, setCookie } from "../../_lib/session";

export const onRequestPost = async ({ request }: { request: Request }) => {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  return privateJson({ ok: true }, 200, [setCookie(SESSION_COOKIE, "", 0)]);
};
