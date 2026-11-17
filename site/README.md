# 热题 100 题解网站

线上地址：https://leetcode.cgent.link （Cloudflare Pages 项目 `lc-hot100`）

- 首页按重要程度 / 难度 / 题型分组，带状态筛选和搜索，顶部的进度矩阵每格是一道题。
- 每道题一页：原题与代码练习、分层提示、逐步动画演示、简洁写法和标准题解、我的历史题解、尝试记录、写代码时注意；标题下有「相关基础」，链到用到的专题。
- `/learn/`：数据结构与算法基础，按「数据结构 / 算法」分组列出 22 个专题，显示每个专题的相关热题做完了几道。`/learn/<slug>/` 是一个专题：每小节有讲解、逐步演示（高亮代码行）、六种语言的代码和注意点，最后是相关热题和自己的状态。

## 在题目页写代码和测试

100 道题都提供两种练习方式，支持 Python、JavaScript、TypeScript：

- **LeetCode**：补全函数或设计类。测试环境提供链表、二叉树等节点类型，并负责准备参数和读取返回值；原地修改题会检查修改后的参数。
- **ACM**：题面改写为完整程序任务，单独说明标准输入、标准输出及样例。编辑器默认空白，由用户编写完整程序。每个用例启动一份程序，处理一组输入。

原页面的题面、提示、动画和题解保留原顺序；宽屏在页面右侧增加独立的代码编辑栏，窄屏按顺序上下显示。语言通过下拉列表选择，标题栏的重置按钮需要再次确认。编辑器支持语法高亮、行号、缩进、查找和撤销。草稿按题号、模式和语言分别保存在当前浏览器中；切换模式、语言和题目不会覆盖其他草稿。专注模式左侧显示题面、右侧编写代码，开关带动画，按 Escape 退出；切换专注模式会保留编辑器、选区和测试结果。模板升级只迁移未修改的旧默认模板，并按模板指纹分代保留迁移前备份；用户编辑过的代码继续保留。

首次点击「运行示例」或「测试全部」后，下方展开示例、自定义和运行结果面板。「运行示例」按题面顺序测试真实样例，「测试全部」运行本项目为这道题准备的全部用例。示例按参数名展示，一维数组保持一行。自定义面板允许修改输入和预期结果：LeetCode 按参数分别填写 JSON，ACM 使用题面规定的文本格式；预期留空时仅运行并显示输出。Ctrl / Command + Enter 可快捷运行示例或当前自定义用例。运行结果显示各用例的输入、实际值、预期值、调试输出和错误，运行中的程序可以停止。

代码在隔离的浏览器执行线程内运行；Python 使用 Pyodide，首次准备环境需要稍候。每例有限时保护，超时会终止执行线程。代码不会通过练习功能上传到服务器，也不会自动写入 GitHub 进度或尝试记录。本项目测试通过不代表力扣官方评测通过。

练习数据在仓库根目录运行 `node tools/practice/build.cjs` 重新生成。修改题面格式、代码模板或用例后，需要重新构建网站。开发验证时，先启动本地预览，再运行 `node tools/practice-ui/test.mjs`；浏览器回归默认使用本机 Chrome，可通过 `CHROME_PATH` 和 `PRACTICE_BASE_URL` 指定其他浏览器路径与预览地址。

## 数据从哪来

网站本身是静态页面。原题、提示和用户进度等数据在运行时由 `functions/`（Cloudflare Pages Functions）通过 GitHub API 读取；练习模板、ACM 题面和练习测试用例则随网站构建发布：

| 网站上的内容 | 仓库里的来源 |
| --- | --- |
| 题目列表、难度、题型 | `studyplan/热题100.md` |
| 每道题的状态 | 登录用户自己的进度仓里的 `progress.json` |
| 重要程度（Hot 20 / P0 / P1 / P2 / P3） | `studyplan/优先级清单.md` |
| 原题 | `problems/<编号>.<题名>.md` 的「题目描述」一节，图片在 `problems/images/` |
| 练习模板、ACM 题面、练习测试用例（`/api/practice/<题号>`） | 资源仓的 `tools/practice/data/<四位编号>.json`，由 `node tools/practice/build.cjs` 从 spec 和判题用例生成；和其他题目资源一样运行时读，push 后一分钟内生效 |
| 分层提示、简洁写法、标准题解（六种语言）、注意点、动画演示（有几种解法就有几个演示，可以切换；每一步高亮对应的代码行） | `tools/illustrations/data/<编号>.json`（由 `tools/illustrations/build.js` 从 spec 和 `code/` 导出） |
| 基础专题的目录和内容（`/api/topics`、`/api/topic/<slug>`；题目页的「相关基础」按专题的 `related` 反查） | `tools/illustrations/data/topics/index.json`、`data/topics/<slug>.json`（由 `build.js` 从 `tools/illustrations/topics/` 和 `code/topics/` 导出）。`/learn/<slug>/` 的页面外壳是静态导出的，slug 列表在 `lib/topic-slugs.ts`：加专题要改它并重新部署，只改内容不用 |
| 用户的常用语言（题解和演示里的代码按它显示） | 登录用户自己的进度仓里的 `settings.json`；没登录时存在浏览器里 |
| 我的历史题解 | 登录用户自己的进度仓里的 `solutions/<语言>/<编号>.*`（Java 文件只取 submit region 里的代码） |
| 尝试记录（每次提交的原样代码、结果和分析，按时间排） | 登录用户自己的进度仓里的 `attempts/<编号>.<题名>/<日期>.<序号>.<结果>.md` |
| 手写图解（spec 标了 `handwritten` 的题，目前没有） | `illustrations/<编号>.<题名>.html`，内嵌在题目页里 |

通过 GitHub 读取的资源只要改仓库、push，网站最多一分钟后就会显示新内容（Functions 在内存里缓存 60 秒）。练习模板、ACM 题面和练习测试用例修改后，需要重新生成数据、构建并部署网站。

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

@heroui-pro/react 需要授权；首次安装或缺包时按 [HeroUI Pro 官方安装文档](https://heroui.pro/docs/react/getting-started/installation) 完成授权。

```bash
npm install
npm run build        # 静态导出到 out/
npm run preview:local # 推荐：读取本地仓库资源，预览尚未 push 的改动
# npx wrangler pages dev out   # 可选：通过 GitHub API 读取远端资源，带 Functions
npx wrangler pages deploy out --project-name lc-hot100 --branch main
```

本地资源预览的端口与配置见 [tools/dev/README.md](../tools/dev/README.md)。使用远端资源预览时，也可以在 `.dev.vars` 中设置 `GITHUB_API` 指向兼容的本地资源服务。
