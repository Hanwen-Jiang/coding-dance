# 热题 100 题解网站

线上地址：https://leetcode.cgent.link ，也可以用 https://codexdance.cn 、https://codingdance.cn （Cloudflare Pages 项目 `lc-hot100`；几个域名之间登录是通的，见下面「多个域名」）

- 首页按重要程度 / 难度 / 题型分组，带状态筛选和搜索，顶部的进度矩阵每格是一道题。
- 每道题一页：原题与代码练习、分层提示、逐步动画演示、简洁写法和标准题解、我的历史题解、尝试记录、写代码时注意；标题下有「相关基础」，链到用到的专题。
- `/learn/`：数据结构与算法基础，按「数据结构 / 算法」分组列出 22 个专题，显示每个专题的相关热题做完了几道。`/learn/<slug>/` 是一个专题：每小节有讲解、逐步演示（高亮代码行）、六种语言的代码和注意点，最后是相关热题和自己的状态。

## 在题目页写代码和测试

100 道题都提供两种练习方式，支持 Python、JavaScript、TypeScript：

- **LeetCode**：补全函数或设计类。测试环境提供链表、二叉树等节点类型，并负责准备参数和读取返回值；原地修改题会检查修改后的参数。
- **ACM**：题面改写为完整程序任务，单独说明标准输入、标准输出及样例。编辑器默认空白，由用户编写完整程序。每个用例启动一份程序，处理一组输入。

原页面的题面、提示、动画和题解保留原顺序；宽屏在页面右侧增加独立的代码编辑栏（默认收起，屏幕右边一个像素把手「<」，第一次来时它自己演几遍提示这里能写代码；点开或往左拖展开，展开过就记住），窄屏按顺序上下显示。语言通过下拉列表选择，标题栏的重置按钮需要再次确认。编辑器支持语法高亮、行号、缩进、查找和撤销。草稿按题号、模式和语言分别保存在当前浏览器中；切换模式、语言和题目不会覆盖其他草稿。专注模式左侧显示题面、右侧编写代码，开关带动画，按 Escape 退出；切换专注模式会保留编辑器、选区和测试结果。模板升级只迁移未修改的旧默认模板，并按模板指纹分代保留迁移前备份；用户编辑过的代码继续保留。

首次点击「运行示例」或「测试全部」后，下方展开示例、自定义和运行结果面板。「运行示例」按题面顺序测试真实样例，「测试全部」运行本项目为这道题准备的全部用例。示例按参数名展示，一维数组保持一行。自定义面板允许修改输入和预期结果：LeetCode 按参数分别填写 JSON，ACM 使用题面规定的文本格式；预期留空时仅运行并显示输出。Ctrl / Command + Enter 可快捷运行示例或当前自定义用例。运行结果显示各用例的输入、实际值、预期值、调试输出和错误，运行中的程序可以停止。

代码在隔离的浏览器执行线程内运行；Python 使用 Pyodide，首次准备环境需要稍候。每例有限时保护，超时会终止执行线程。本项目测试通过不代表力扣官方评测通过。

登录并开通进度仓后，练习区会写进用户自己的进度仓（`lib/practice/record.ts` 按进度仓的规则生成文件，`/api/progress/practice` 写入）：Ctrl+S 和停下 60 秒后自动存草稿（`drafts/`）；全量测试跑完自动记一条尝试记录，全部通过再存成题解；「保存」菜单可以手动「存为尝试记录」（示例、精简、自定义用例没通过的那次也能记，写明是哪组用例；全部通过但不是全量的会先跑全量——「通过」只能来自全量测试）和「存为我的题解」（不管通没通过都存，没全量通过的写法名标「未通过」或「未验证」，在「我的历史题解」里看得出来；同一份代码不重复存）。没登录时草稿只存在浏览器里。

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

通过 GitHub 读取的资源只要改仓库、push，不用重新部署。公共的资源接口（`/api/problems`、`/api/problem/<题号>`、`/api/practice/<题号>`、`/api/topics`、`/api/topic/<slug>`、`/api/raw/...`）在 Cloudflare 每个机房缓存（`functions/_lib/edge-cache.ts`）：60 秒内直接用缓存；过了 60 秒，下一次请求先拿到旧内容、同时在后台刷新，再下一次就是新的（响应头 `X-Edge-Cache` 是 `HIT` / `STALE` / `MISS`）。所以 push 一分钟后打开页面，可能要刷新两次才看到新内容。登录用户自己的接口（`/api/session`、`/api/progress*`、`/api/solutions`、`/api/settings`、`/api/sync/*`、`/api/auth/*`）不经过这个缓存，也不能加。练习模板、ACM 题面和练习测试用例修改后，需要重新生成数据、构建并部署网站。

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

### 多个域名（https://leetcode.cgent.link、https://codexdance.cn、https://codingdance.cn）

三个域名都是 Pages 项目 `lc-hot100` 的自定义域名，内容一样。浏览器不让不同域名共用 Cookie，所以登录状态靠整页跳转在几个域名之间传（`functions/_lib/sso.ts`，测试 `functions/_lib/test/sso.test.ts`）：

- `wrangler.toml` 的 `SITE_ORIGINS` 列出这几个域名，**第一个是登录域名**。GitHub App 只登记了它的回调地址，登录、授权都在它上面走 GitHub；在别的域名点登录，先跳到登录域名，登录域名已经登录的话不用再去 GitHub。
- 登录成功后顺着列表把其余域名都走一遍（每个域名三次跳转：`/api/auth/link` 记随机数 → 登录域名 `/api/auth/bridge` 开票据 → `/api/auth/accept` 写 Cookie），之后在哪个域名打开都是登录状态。票据加密、2 分钟过期、只给指定域名用，还要和那个域名上的随机数 Cookie 对上，别人拿着自己的票据链接骗不了你登录成他的账号。
- 以前只在登录域名上登录过的用户，在登录域名上打开页面时 `/api/session` 返回 `spread`，页面先测一下其余域名连不连得上，再经 `/api/auth/spread` 补同步一次（只补一次）。
- 退出时 `POST /api/auth/logout` 返回下一站，页面跳过去把每个域名的会话都清掉（`/api/auth/signout`，要带 logout 发的凭证，别的网站没法随手让你退出）。
- 几个域名的会话是同一套 GitHub 令牌。GitHub 的 refresh token 只能用一次，用过之后旧的令牌也作废，所以令牌快过期时先看 KV（绑定 `SESSIONS`，命名空间 `lc-hot100-sessions`）：别的域名已经换过就直接用，自己换成功了存进去（加密）给别的域名用。
- 换登录域名：先在 GitHub App 设置里加上新域名的回调地址（`https://<域名>/api/auth/callback`），再把它挪到 `SITE_ORIGINS` 第一个。加一个新域名：先在 Pages 项目里加自定义域名，再加进 `SITE_ORIGINS`；已经登录的用户下次在登录域名上打开页面时会自动补同步到新域名。
- `*.pages.dev` 这类不在列表里的地址不参与，和只有一个域名时一样。

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

## 首屏加载

大部分访客在国内，首次打开要快、不能依赖国外的第三方服务：

- **字体自托管**：Inter、JetBrains Mono、Silkscreen 的 latin 子集放在 `app/fonts/`（取自 fontsource，附 OFL 许可证），由 `app/fonts.ts` 用 `next/font/local` 输出到 `/_next/static/media/`。页面不请求 Google Fonts。正文和像素字体预加载，等宽字体用到才下载；都是 `font-display: swap`，等待期间用按字宽缩放过的后备字体，换上来时文字不跳。
- **HeroUI 样式按组件引入**：`styles/heroui.css` 只引入用到的组件（OSS 和 Pro），整包有 680 KB。**用到新的 HeroUI 组件时，要在这个文件里加上它的样式**，否则组件没有样式；组件内部用到的组件也要有（比如 Select 要 list-box、popover）。
- 首页的统计卡片没有用 Pro 的 `KPI` 组件（从 `@heroui-pro/react/kpi` 引入会连带 recharts，首页多 390 KB JS），而是在 `components/problem-list.tsx` 里按它的结构写了一样的标记，样式还是 Pro 的 `kpi.css`。
- **缓存**（`public/_headers`）：`/_next/static/*`（文件名带内容哈希）和 `/practice-runtime/vendor/*` 缓存一年（`immutable`）；HTML 每次回源确认。Pyodide 和 TypeScript 由 `npm run prepare:practice` 复制到带版本号的目录 `public/practice-runtime/vendor/pyodide/<版本>/`、`vendor/typescript/<版本>/`，版本号由 `next.config.mjs` 从 `node_modules` 读出来写进 `lib/practice/runner.ts`，升级依赖后路径自动变，不会用到旧缓存。

### 静态资源放到别的域名（可选，目前没用）

`next.config.mjs` 的 `assetPrefix` 读构建时的环境变量 `ASSET_PREFIX`，默认空，静态资源和页面同域。以后要把 `/_next/static`（JS、CSS、字体）放到国内的 CDN 或对象存储（腾讯云 COS、阿里云 OSS 加 CDN）上：

1. 那边的配置：
   - **跨域**：字体是跨域加载的，要返回 `Access-Control-Allow-Origin`（`*`，或者列出网站的几个域名）；JS、CSS 也加上，免得以后用到 `crossorigin`。
   - **类型**：`Content-Type` 要对（`.js` 是 `application/javascript`、`.css` 是 `text/css`、`.woff2` 是 `font/woff2`），对象存储按扩展名自动识别时检查一遍。
   - **缓存**：`Cache-Control: public, max-age=31536000, immutable`，文件名带哈希，内容不会变。
   - **域名**：国内 CDN 绑定自定义域名要 ICP 备案。
2. 构建：`ASSET_PREFIX=https://<静态资源域名> npm run build`。
3. 发布顺序：**先把 `out/_next/static/` 原样上传**（只增不删，旧页面还在用旧文件），**再部署 HTML**（`wrangler pages deploy out ...`）。反过来的话，新页面会引用还没上传的文件。

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
