import { type BffEnv, handleBffRequest } from "../_lib/bff.ts";

export const onRequest = (ctx: { request: Request; env: BffEnv; next: () => Promise<Response> }) =>
  handleBffRequest(ctx);
