import { type CompanionEnv, forwardCompanion } from "../../_lib/companion.ts";

export const onRequestPost = async ({ request, env }: { request: Request; env: CompanionEnv }) =>
  forwardCompanion(request, env, "hint-reveal");
