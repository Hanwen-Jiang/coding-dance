# `feat/go-modernization` 分支问题记录与再合并前检查清单

> **背景**：2026-11-26 将 `feat/go-modernization`（`c0d8ea6`）提前合入 `main`（`eb537dc`）后，直接导致线上 `codingdance.cn`、`codexdance.cn`、`leetcode.cgent.link` 全站核心功能中断（动画题解退回旧版、题解内容丢失、练习区无法加载与运行代码、登录与进度接口报 `503`）。已通过 `7d9ef44` 回滚 `main` 恢复线上服务。本文档集中记录该分支当前存在的阻塞问题与再次合并前的硬性前置条件。

---

## 一、已确认的阻塞问题清单

### 1. [P0] Phase 3 删除了 375 个派生 JSON，但 R2 / Pages 静态资产链路未闭环
- **现象**：线上 `/api/practice/1` 返回 `404 {"error":"这道题还没有练习数据"}`；`/api/problems` 与 `/api/problem/1` 的 `hasSpec` 全部变为 `false`，且缺少 `Demo V2` 动画 spec 与题解列表（页面退回早期的 `demo.json` / 纯文本兜底）。
- **根因**：
  - Phase 3 提交（`55ec2f3`）从 GitHub 仓库直接删除了：
    - `tools/practice/data/`（100 个题目练习数据 JSON）
    - `tools/illustrations/data/`（101 个动画/题解主数据 JSON）
    - `tools/illustrations/cases/`（100+ 个动画用例 JSON）
  - 线上 Cloudflare Pages（`lc-hot100`）当前的 `GITHUB_BRANCH = "main"` 仍会在运行时从 GitHub 仓库读取这些路径；一旦从 `main` 删掉且没有替代资产，所有题目瞬间失去练习数据、题解和动画。
  - 与此同时，新分支的三级回退（`site/functions/_lib/r2.ts`：`R2_ASSETS_BASE_URL` → Pages 静态 `/_r2/v1/manifest.json` → GitHub API）并未落地：
    1. Cloudflare Pages 未配置 `R2_ASSETS_BASE_URL`（也没有上传 `_r2/v1/` 资产到 R2）；
    2. 仓库内没有随构建提交 `site/public/_r2/v1/`，且 `site/package.json` 的 `build` 脚本未调用 `cd-build` 生成它。

### 2. [P0] Phase 2 BFF 硬切 `CD_API_UPSTREAM`，缺少降级兼容导致登录/进度全部 `503`
- **现象**：部署 `eb537dc` 到 `lc-hot100` 后，`/api/session` 返回 `{"configured":false,"user":null}`，`/api/auth/login`、`/api/progress` 等路由直接返回 `503 {"error":"cd-api BFF 服务尚未配置（请设置 CD_API_UPSTREAM）"}`。
- **根因**：
  - Phase 2 提交（`bb8e31c`）删除了原有 Cloudflare Pages Functions 直连 GitHub API + KV 的登录、SSO、进度与题解路由（`site/functions/api/auth/*`、`progress/*`、`solutions/*`、`sync/*`、`session.ts`、`settings.ts`），统一交给 `site/functions/_lib/bff.ts` 转发到 `CD_API_UPSTREAM`（Go `cd-api`）。
  - 但生产环境中 `cmd/cd-api` 及其 PostgreSQL / Valkey 依赖尚未部署上线，Cloudflare Pages 生产环境变量中也未设置 `CD_API_UPSTREAM`（以及可选的 `CD_API_ACCESS_ID` / `CD_API_ACCESS_SECRET`）。

### 3. [P1] `site/package.json` 构建与运行依赖链断开
- **问题点**：
  - 在 `feat/go-modernization` 上，`site/package.json` 的 `"build"` 改成了纯 `next build`（去掉了 `npm run prepare:practice`），且没有自动触发 `cd-build` 生成 `site/public/_r2/v1/` 与 WASM manifest。
  - 若无前置构建脚本生成，直接 `npm run build` 产出的 `out/` 会缺少练习运行时与 `_r2/v1/` 清单，从而触发上面的 404/退化问题。

### 4. [P1] 前端调试面板与 Phase 1 `/api/dap`、Watch 输入框尚未打通
- **问题点**：
  - 后端 `cd-runner` 已在 `internal/runner/dap.go` 和 `site/functions/api/dap.ts` 实现了 `Java / C++ / Go` 的 WebSocket DAP 调试（支持断点停住和 `evaluate` 表达式求值），但前端 `workbench.tsx` / `remote.ts` / `debugger.tsx` 仍只调用 `POST /api/run`（`debug: true`）做离线录制回放，没有连接 `/api/dap`，也没有提供变量/表达式追踪输入框。
  - *(注：这部分前端适配改动已暂存在本地 `git stash` 的 `"wip: debug watch input and DAP client"` 中，待在干净的 `main` 基线上补齐单测与构建验证后即可合入。)*

### 5. [P1] 未在 Preview 环境冒烟验证即直接合入 `main`
- **教训**：`main` 分支同时承担着 **GitHub 数据源（`GITHUB_BRANCH = "main"`）** 与 **Cloudflare Pages 生产分支** 两个角色。在 `cd-api` 和 R2 资产尚未独立部署就绪前，直接把删除 JSON 和切换 BFF 的分支合入 `main`，即使不重新部署 Cloudflare Pages，也会立即破坏线上正在运行中的 Pages Functions 数据读取。

---

## 二、再次合并 `feat/go-modernization` 前的硬性检查清单（Checklist）

在确认以下全部条件满足并验证通过前，**禁止**将该分支合入 `main`：

1. **数据源就绪（二选一，推荐先 R2）**：
   - [ ] 使用 `go run ./cmd/cd-build build` 生成完整的 `v1/manifest.json` 及内容寻址分片，上传到 R2 并在 Cloudflare Pages 配置好 `R2_ASSETS_BASE_URL`（含 Production 与 Preview）；**或**确保 `site/package.json` 的 `build` 自动生成 `site/public/_r2/v1/` 并确认包体积符合 Pages 限制。
   - [ ] 如果还需要支持平滑过渡期回退，不要在第一批合并时就删光 `tools/practice/data/` 和 `tools/illustrations/data/`，等 R2 线上验证稳定后再单独提交清理 PR。
2. **Go `cd-api` 后端就绪**：
   - [ ] `cmd/cd-api`（含 PostgreSQL 与 Valkey/KV）已在公网或 Cloudflare Tunnel 上稳定运行，`/healthz` 返回 `200`。
   - [ ] Cloudflare Pages `lc-hot100` 已配置好 `CD_API_UPSTREAM`（以及必要的 `CD_API_ACCESS_ID` / `CD_API_ACCESS_SECRET`、`EDGE_PROXY_KEY`）。
   - [ ] 若前端经过 EdgeOne 反代，确保 EdgeOne 回源保留 `X-Forwarded-Host`、`X-Forwarded-Proto` 与 `X-Edge-Proxy-Key`。
3. **Go `cd-runner` 运行器就绪**：
   - [ ] `RUNNER_NODES` 对应节点已升级为 Go `cd-runner`，`/api/run`（GET）返回 `features` 包含 `dap-ws` 与 `ts-transform`。
4. **Preview 环境全量冒烟验证通过**：
   - [ ] 在 Cloudflare Pages Preview 部署中实测以下接口全部正常，再合入 `main`：
     - `GET /api/problems` → `200`，第 1 题 `hasSpec: true`、`hasIllustration: true`
     - `GET /api/problem/1` → `200`，包含完整题解与 `Demo V2` 动画 spec
     - `GET /api/practice/1` → `200`，返回完整练习题数据与 `starters`
     - `GET /api/session` → `200`，`configured: true`
     - GitHub 登录 / 退出、`codingdance.cn` 与 `leetcode.cgent.link` SSO、以及运行/保存进度流程全通。
