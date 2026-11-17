# 热题 100 题解网站

线上地址：https://leetcode.cgent.link （Cloudflare Pages 项目 `lc-hot100`）

- 首页按重要程度 / 难度 / 题型分组，带状态筛选和搜索，顶部的进度矩阵每格是一道题。
- 每道题一页：原题、分层提示、逐步动画演示、简洁写法和标准题解、我的历史题解、尝试记录、写代码时注意；标题下有「相关基础」，链到用到的专题。
- `/learn/`：数据结构与算法基础，按「数据结构 / 算法」分组列出 22 个专题，显示每个专题的相关热题做完了几道。`/learn/<slug>/` 是一个专题：每小节有讲解、逐步演示（高亮代码行）、六种语言的代码和注意点，最后是相关热题和自己的状态。

## 数据从哪来

网站本身只是静态页面，数据在运行时由 `functions/`（Cloudflare Pages Functions）通过 GitHub API 读取这个仓库：

| 网站上的内容 | 仓库里的来源 |
| --- | --- |
| 题目列表、难度、题型 | `studyplan/热题100.md` |
| 每道题的状态 | 登录用户自己的进度仓里的 `progress.json` |
| 重要程度（Hot 20 / P0 / P1 / P2 / P3） | `studyplan/优先级清单.md` |
| 原题 | `problems/<编号>.<题名>.md` 的「题目描述」一节，图片在 `problems/images/` |
| 分层提示、简洁写法、标准题解（六种语言）、注意点、动画演示（有几种解法就有几个演示，可以切换；每一步高亮对应的代码行） | `tools/illustrations/data/<编号>.json`（由 `tools/illustrations/build.js` 从 spec 和 `code/` 导出） |
| 基础专题的目录和内容（`/api/topics`、`/api/topic/<slug>`；题目页的「相关基础」按专题的 `related` 反查） | `tools/illustrations/data/topics/index.json`、`data/topics/<slug>.json`（由 `build.js` 从 `tools/illustrations/topics/` 和 `code/topics/` 导出）。`/learn/<slug>/` 的页面外壳是静态导出的，slug 列表在 `lib/topic-slugs.ts`：加专题要改它并重新部署，只改内容不用 |
| 用户的常用语言（题解和演示里的代码按它显示） | 登录用户自己的进度仓里的 `settings.json`；没登录时存在浏览器里 |
| 我的历史题解 | 登录用户自己的进度仓里的 `solutions/<语言>/<编号>.*`（Java 文件只取 submit region 里的代码） |
| 尝试记录（每次提交的原样代码、结果和分析，按时间排） | 登录用户自己的进度仓里的 `attempts/<编号>.<题名>/<日期>.<序号>.<结果>.md` |
| 手写图解（spec 标了 `handwritten` 的题，目前没有） | `illustrations/<编号>.<题名>.html`，内嵌在题目页里 |

所以平时只要改仓库、push，网站最多一分钟后就会显示新内容（Functions 在内存里缓存 60 秒），不用重新部署。

## 登录和每个人自己的进度

- 题目资源（资源仓）对所有人都一样；进度和题解来自登录用户自己账号下的 `hot100-progress` 仓库。没登录时显示 0 进度。
- 登录走 **GitHub App**：权限是授权范围内仓库的 Contents 读写、建仓库（Repository creation），外加 Starring。授权范围（全部仓库，或者只选几个）由用户在 GitHub 的授权页面上选。用户的令牌 8 小时过期，服务端用 refresh token 自动续。
- 界面上统一叫「授权」（GitHub 那边叫安装 App）。新用户点登录后，回调（`functions/api/auth/callback.ts`）发现他还没授权，会接着跳到授权页，在 GitHub 上一口气走完。
- 回到网站后，首页的开通卡片（`components/account.tsx` 的 `SetupCard`）让用户选私有 / 公开、勾选要 Star 的仓库，点一下就由 `POST /api/progress/create` 用模板仓 `Hanwen-Jiang/hot100-progress-template`（wrangler.toml 里的 `TEMPLATE_REPO`）在他账号下建好 `hot100-progress`，不用去 GitHub。GitHub 会把 App 建的仓库自动放进授权范围。
- 手动的路还留着：老的授权没有建仓库的权限、账号下已经有同名仓库、或者用户想只授权一个仓库时，自己去 GitHub 用模板建仓库，再把它放进授权范围。私有仓库在授权之前网站看不到，所以这条路上「仓库建好了没有」靠用户点「我建好了」。
- 用户的令牌用 `SESSION_SECRET` 加密后放在 HttpOnly Cookie 里，浏览器脚本读不到；写操作只接受本站页面发起的请求。
- 进度仓的文件规则见模板仓 README；`functions/_lib/progress.ts` 按同一套规则读写。

GitHub App 的配置（GitHub → Settings → Developer settings → GitHub Apps → New GitHub App）：

| 项目 | 填什么 |
| --- | --- |
| Homepage URL | `https://leetcode.cgent.link` |
| Callback URL | `https://leetcode.cgent.link/api/auth/callback` |
| Expire user authorization tokens | 勾上 |
| Request user authorization (OAuth) during installation | 勾上 |
| Webhook → Active | 不勾 |
| Repository permissions | Contents: Read and write；Metadata: Read-only；Repository creation: Read and write |
| Account permissions | Starring: Read and write |
| Where can this GitHub App be installed? | Any account |

建好后把 App 的 slug 填进 `wrangler.toml` 的 `GITHUB_APP_SLUG`，再设三个加密环境变量（client secret 在 App 页面上点 Generate a new client secret 生成，只显示一次）：

```bash
wrangler pages secret put GITHUB_APP_CLIENT_ID --project-name lc-hot100
wrangler pages secret put GITHUB_APP_CLIENT_SECRET --project-name lc-hot100
wrangler pages secret put SESSION_SECRET --project-name lc-hot100
```

这几项没设齐时，网站照常能看，只是不显示登录入口。

## 从力扣同步（`/sync/`）

不用装任何东西：用户把页面上的「同步力扣」按钮拖到书签栏，在 leetcode.cn 上点它。

1. 书签（`lib/sync/bookmarklet.ts`）打开本站的 `/sync/?from=leetcode`。同步页和力扣页面通过 postMessage 说话：同步页发只读的 GraphQL 查询，力扣页面用它现成的登录状态代发，再把结果传回来（`lib/sync/bridge.ts`）。书签只认本站同步页的消息、拒绝 mutation；同步页只认 `https://leetcode.cn` 的回复。
2. 同步页在浏览器里比对力扣上的提交和进度仓里已有的记录（`lib/sync/plan.ts`、`core.ts`），列出要写入的内容让用户勾选。
3. 用户确认后，`/api/sync/commit` 用用户在本站的 GitHub 登录把内容写成一个 commit。服务端只转手不保存，只肯写 `progress.json`、`attempts/skip.txt` 和符合规则的尝试记录（`lib/sync/server.ts`）。读仓库用 `/api/sync/repo` 和 `/api/sync/blobs`。

测试：在 `site/` 里 `npm test`。本地联调时可以在 `.dev.vars` 里写 `SYNC_GITHUB_API=http://127.0.0.1:<端口>`，让这三个接口去请求一个假的 GitHub；线上不设这个变量。

## 令牌

仓库是私有的，Functions 用加密环境变量 `GITHUB_TOKEN` 读它。令牌只存在 Cloudflare 里：

```bash
wrangler pages secret put GITHUB_TOKEN --project-name lc-hot100
```

不要把令牌写进 `wrangler.toml`、`.dev.vars` 以外的任何文件，也不要提交 `.dev.vars`。仓库公开后可以删掉这个 secret，接口照样能用（未认证请求每小时有 60 次的限额，靠缓存一般够用）。

## 本地开发和部署

```bash
npm install          # @heroui-pro/react 需要授权：缺包时运行 HeroUI Pro 的 hpsetup 安装
npm run build        # 静态导出到 out/
npx wrangler pages dev out     # 本地预览，带 Functions
npx wrangler pages deploy out --project-name lc-hot100 --branch main
```

本地预览时可以在 `.dev.vars` 里写 `GITHUB_API=http://127.0.0.1:<端口>` 指向一个模拟的 GitHub API，用本地仓库的数据测试还没 push 的改动。
