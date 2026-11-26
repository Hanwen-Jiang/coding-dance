// 只管 /api/*：本地测试时（.dev.vars 里设了 SYNC_GITHUB_API）让用户令牌的请求去一个假的 GitHub。线上不设这个变量，什么都不做。
import { setUserApi } from "../_lib/progress";

export const onRequest = (ctx: { env: { SYNC_GITHUB_API?: string }; next: () => Promise<Response> }) => {
  setUserApi(ctx.env.SYNC_GITHUB_API);
  return ctx.next();
};
