# 仓库约定

力扣「热题 100」的**资源仓**：只放不变的题目资源，人人看到的都一样。个人进度和自己写的题解放在各自的**进度仓**里（模板 `Hanwen-Jiang/hot100-progress-template`，我的是 `Hanwen-Jiang/hot100-progress`）。

## 目录

- `problems/<编号>.<题名>.md`：题目文档，一题一份，含难度、专题、重要程度、原题和图解链接。不写个人状态。
- `illustrations/<编号>.<题名>.html`：解题思路图解。
- `studyplan/热题100.md`（按专题的题单）、`studyplan/优先级清单.md`（100 题按重要程度排序，Hot 20 重点 / P0 必做 / P1 重要 / P2 补全 / P3 选做）。网站按这两个文件解析题单和重要程度，改表格格式时要同步改 `site/functions/_lib/repo.ts`。
- `tools/` 与 `cmd/cd-build/`：图解与练习生成器。`tools/illustrations/` 下保留手写源码：`specs/`（每题一份 spec，Python 代码写在里面）、`code/<四位题号>/<key>.<后缀>`（其他语言的题解）、`judge/langs/` 与 `judge/prelude/`（供云端沙箱 `tools/runner` 复用）。「数据结构与算法基础」专题源码在 `tools/illustrations/topics/<slug>.js` 与 `code/topics/<slug>/`。原派生 JSON 目录（`tools/illustrations/data/`、`tools/illustrations/cases/`、`tools/practice/data/`，共 375 份文件）自 Phase 3 起不再提交 Git，统一下沉为构建产物，由纯 Go 并发 CLI `cd-build`（`cmd/cd-build` + `internal/builder` + `contracts/practice-meta.json`）在 CI / 本地按需生成并打包内容寻址 R2 资产目录。
- `.github/workflows/verify.yml`：CI。每次 push 由 `cd-build build` / `verify` / `judge` 并发 rebuild 全量题库、验证图解/步骤标记/练习模板一致性、对六种语言逐题判题，并验证零私有源静态站构建与 `out/_r2/v1/manifest.json`。
- `site/`：题解网站（Next.js 静态导出 + HeroUI 样式 + 内置零私有源 Pro 兼容层与预编译样式，部署在 Cloudflare Pages 项目 `lc-hot100`，域名 https://leetcode.cgent.link）。网站不依赖私有 npm Token，直接 `npm install && npm run build` 即可完整构建；静态资产优先通过三级内容寻址清单读取。登录用户的进度和题解从各自进度仓（经 `cd-api` 热存储与异步双写）读写。
- `cmd/cd-runner/` 与 `tools/runner/`：远端运行器（Java / C++ / Go 的练习在云端运行和交互式 DAP 调试，共十五种云端语言运行），按**集群**设计：每台虚拟机 / KVM 主机是一个节点（编号 + `run-<编号>.codingdance.cn`），节点之间不共享状态，宿主机运行零 Node.js 依赖的 Go 静态单二进制 `cd-runner`（`internal/runner`），网站按用户固定节点、满了或下线了换下一个。每次运行或交互式 DAP 调试独占一台 Firecracker microVM（自己的内核、没有网卡），这一层用作者另一个仓库 agent-runtime 的 fc-manager 和 sandbox-agent（固定提交，`tools/runner/deploy/firecracker.sh`），不另写；Docker 只能开发和 CI 用。第一个节点 `lou1` 在作者的 Windows 机器 win-gw-lou 上开的 Linux 虚拟机里，经 Cloudflare Tunnel 对外；网站经 `/api/run`、`/api/dap` 与 `/api/admin/runner` 签名调用（`site/functions/_lib/runner.ts` 和 `internal/runner/sign.go` 的算法要一致）。部署、配置、测试见 `tools/runner/README.md`。
- `ROADMAP.md`：在线练习（浏览器里编译运行六种语言、调试、云端容器、额度和订阅、测试用例设计）的路线图、实测数据和任务清单。做相关工作前先看，认领任务、完成后打勾并补变更记录。
- `site/lib/sync/`：「从力扣同步」的逻辑（网站 `/sync/` 页面用）：把用户在 leetcode.cn 上的提交记录写进他自己的进度仓。测试在 `site/lib/sync/test/`，在 `site/` 里运行 `npm test`（`node lib/sync/test/sync.test.ts`）。

## 工作约定

- 为某道题做的解法图解 / 提示类 artifact，都要把 HTML 源文件存进 `illustrations/`，并在该题的题目文档里加「思路图解」一节，写上本地文件和在线 artifact 链接。存进仓库的文件第一行加 `<meta charset="utf-8">`，保证本地打开不乱码。
- 图解用 `tools/illustrations/` 生成：每题写一份 `specs/<编号>.js`，运行 `node tools/illustrations/build.js <题号>`。构建会自动核对演示答案并测试页面里的 Python 代码。发布后把链接记进 `tools/illustrations/artifacts.json`，并更新 `illustrations/README.md` 索引。
- 一道题有几种真正不同的解法时，演示也做几种，网站和图解页上可以切换：spec 自己的 `build` 是第一种（`method` 写它的名字，要和标准解法对应），其余放进 `alts: [{ t, note, legend, build }]`，每种都要在 `codes` 里有对应的代码。所有解法共用 `presets` 和随机输入，build 会逐个核对答案。只是写法不同（切片、内置函数）的不另做。不同解法给出的结果顺序可能不一样时，spec 里加 `cmp: "unordered"`。
- **动态规划的演示要讲清边界和空间压缩**：
  - 边界画出来：转移会读到越界位置的（`dp[i][j-1]` 在 `j = 0`、`dp[i-c]` 在 `c > i`……），在表外多画一圈虚线格子（颜色角色 `x`，行列号用 `rowLabels` / `colLabels` / `labels` 写 -1），写上它当成什么值（计数题 0、求最小 ∞、空串……），读到它的那一步高亮成 `"x e"` 并在说明里讲为什么取这个值；多开一行一列的边界（`dp[0][j]`）和直接给定的 `dp[0]` 也用 `x` 标出来。
  - 能压缩空间的（二维压成一行、一维压成几个变量）单独做一种演示「空间压缩」（代码 key 一般叫 `roll`，六种语言都要有）：画出一行 dp 里哪些格子已经是这一行（`k`）、哪些还是上一行（`g`），以及被覆盖的值怎么提前存下来（比如编辑距离的 `leftup`）。参考 62、64、72、1143、70、198。
- 题面里力扣的图片要换成「配图」：spec 写 `figures: { "<图片文件名>": [视图…] }`，视图用 `tools/illustrations/fig.js` 拼（树用力扣的层序数组、链表可以画环和 random 指针、`row` 并排加箭头、`graph` 画 Y 形这类自由形状）。网站显示配图并留「力扣原图」的链接；build 会核对键是题面里真有的图片，`--strict` 时每张图都要有配图。
- **演示的每一步要指到代码行**。代码行尾写步骤标记：Python `#@tag`，其他语言 `//@tag`（一行可以写几个，逗号分隔；同一个 tag 可以标多行）。演示里每一步 `snap(phase, msg, views, { at: "tag" })`（可以是数组；确实不对应任何代码的步骤写 `at: []`）。build 会去掉标记、导出 tag → 行号，并核对：每一步都有 `at`，写的 tag 在代码里有，各语言的 tag 集合和 Python 一致。演示的其他解法用 `alts[].code = "<key>"` 指到对应的那段代码（`codes[].key`；第一段默认是 `std`）。
- **官方题解有六种语言**：Python（写在 spec 里）、Java、C++、Go、JavaScript、TypeScript（放 `tools/illustrations/code/<四位题号>/<key>.<java|cpp|go|js|ts>`，内容是能直接提交到力扣的代码，带同样的步骤标记）。演示用到的每段代码六种语言都要有；纯 Python 惯用法的「简洁写法」只有 Python。
- **每段代码都要过判题**。spec 里写 `sig`（函数名、参数类型、返回类型；设计类题写类和方法，写法见 `judge/util.js`；要按「是不是同一个节点」判的题用 `CycleList`、`JoinList`、`NodeIndex`、`TreeRef`、`TreeVal`、`RandomList` 这几种类型，见 141、142、160、236、138）和 `call(args, H)`（把演示的输入变成力扣的参数列表，`H` 是 `makeR()` 的工具函数），需要的边界用例写在 `cases` 里。`go run ./cmd/cd-build build --root . [--quick] [--strict] [--bundle site/public/_r2]` 并发导出图解、判题用例（预设 + `cases` + 10 组固定种子的随机输入，`fixed` 标记非随机组）及练习数据；`go run ./cmd/cd-build judge --root . [--lang java,cpp] [题号…]` 按核数并发编译运行并对答案（自动检测本机 `site/node_modules/typescript/bin/tsc` 或 `TSC` 环境变量）。
- 改题解代码的流程：在当前分支上改 → 本机 `cd-build build`、`cd-build verify` 与 `cd-build judge` 通过 → push 分支，等 CI 六种语言全绿 → 合进 main。不要把没过 CI 的代码直接 push 到 main（网站实时读 main）。
- **Git 提交共同作者**：本仓库的提交（以及 PR squash merge 的提交说明）统一在末尾附带 `Co-authored-by: codexdance <git@codexdance.cn>`，与当前主提交账号共同署名。
- 每份 spec 的 `codes` 里第一段是标准解法；再放一段 `kind: "elegant"` 的简洁 Python 写法（标准解法本身已经足够简洁时，直接给第一段标 `kind: "elegant"`）。
- 演示的「随机」输入写在 `tools/illustrations/random.js` 的 `GEN[题号]` 里：返回 `{ args, note, py, cmp }`，规模控制在演示看得过来的范围内，并满足题目约束（有唯一解、数组有序等）。`py` 是用标准解法算同一输入的 Python 表达式（辅助函数在 `random_prelude.py`），build 时每题随机 40 组，演示答案必须和它一致。新增或改动演示的输入格式时要同步改这里。
- Phase 3 起派生 JSON（`tools/illustrations/{data,cases}/` 与 `tools/practice/data/`）不再提交 Git；本地开发 / 部署时执行 `go run ./cmd/cd-build build --root . [--bundle site/public/_r2]` 按需生成，云端 Pages Functions（`site/functions/_lib/r2.ts`）优先经 `R2_ASSETS_BASE_URL` → 静态绑定 `env.ASSETS` (`/_r2/v1/...`) 读取内容寻址清单，本地预览兼容回退 `tools/dev/resource-api.mjs`。
- 题目页的「练习」（浏览器里写代码、运行、测试，力扣模式和 ACM 模式）的题面描述与手写边界用例统一维护在声明式契约 `contracts/practice-meta.json`（由 `cd-build build` 与 `contracts/schema/problem.schema.json`、`problems/*.md`、`leetcode-starters.json` 并发生成练习数据，无需单独运行脚本）；`node tools/practice/test.cjs` 检查数据（复用 `cd-build dump-official-examples`），`node tools/practice-runtime/test.mjs` 检查运行器（要 `site/node_modules` 里有 pyodide 和 typescript）。
- 练习区的 Java、C++、Go 和 C、C#、Kotlin、Swift、Rust、Ruby、PHP、Scala、Dart 在云端运行（`tools/runner`）。后九种的力扣模式起始代码用力扣原样的（`tools/practice/leetcode-starters.json`，`node tools/practice/fetch-starters.mjs` 重新取；力扣没有的写在 `templates.cjs` 的 `AUTHORED_STARTERS`），判题程序（`tools/illustrations/judge/langs/<语言>.js`）按同样的类型和函数名调用。改了这两边跑一遍 `tools/runner/test/starters.test.mjs`（在镜像里跑，见 `tools/runner/README.md`），CI 也跑。
- **基础专题**（网站 `/learn/`，22 个：数据结构 9 + 算法 13）：一个专题一份 `tools/illustrations/topics/<slug>.js`，`{ slug, name, kind: "ds" | "algo", order, lede, related: [热题题号…], sections }`。每小节 `{ key, t, body: [段落 HTML], points?, codes, sig, call, cases, gen?, demo? }`：
  - `codes` 的第一段 key 必须写成小节的 key（判题器按它找 `code/topics/<slug>/<key>.<后缀>`），其余代码的 key 在同一个专题里不能重复（同一个目录）。六种语言都要有、带同样的步骤标记、都要过判题；不对应演示的纯 Python「简洁写法」只有 Python。
  - `sig` / `cases` 的写法和题目 spec 一样（设计类题也行；C++ 设计类的构造函数和方法参数要写成 `const vector<int>&` 或传值，判题器传进去的是临时对象）。`gen(R)` 是随机输入（`R` 是 `makeR()`），返回 `{ args, note }`，网站的「随机」用它，build 也用它出 10 组判题用例、并随机 20 组核对演示答案和 Python 一致；`call(args)` 把演示的输入变成力扣的参数。
  - `demo: { method?, legend, presets: [{ label, args, note, expect? }], build, alts? }`：规则和题目 spec 相同（每步写 `at`，写了 `expect` 就核对答案；动态规划照上面的约定画边界、单独做「空间压缩」）。图、拓扑排序、并查集用 `net` 视图（节点排成一圈或按 `pos` 摆，`directed` 画箭头，`badges` 写在节点下方）。
  - `related` 只能写热题 100 的题号。网站按它列「相关热题」和完成情况，题目页反过来显示「相关基础」。
  - `node tools/illustrations/build.js --topics`（或写专题的 slug）只处理专题；不带参数的全量 build（CI）题目和专题一起做。加专题时把 slug 加进 `site/lib/topic-slugs.ts`（`/learn/<slug>/` 是静态导出的，build 会核对两边一致），然后重新部署网站；只改专题内容不用部署。
- 修改已发布的图解时，用题目文档里记录的 artifact 链接原地更新，不要新建一个链接。
- 做题记录不改这个仓库，都存进自己的进度仓：
  - 每一次值得记的尝试（通过、答案错误、超时、运行出错、思路不成立）都按 `attempts/<四位题号>.<题名>/<YYYY-MM-DD>.<序号>.<结果>.md` 记一份：原样代码（不要改好再存；不是原样时写 `verbatim: false`）、错在哪里、怎么发现的、差在哪一步。写进去的结论先在本地复现一遍。
  - 状态写在 `progress.json` 对应题号的 `status`：通过了记 `已通过`，提交过但还没通过记 `尝试过`（网站上点一下也行）。
  - 通过后把整理好的写法按 `solutions/<语言>/<四位题号>.<题名>[.<写法>].<后缀>` 存一份。网站练习区「存为我的题解」也能存没通过的代码（失败也值得留着），写法名标「未通过」或「未验证」（ACM 模式是「ACM未通过」），规则在 `site/lib/practice/record.ts`。
  - 常用语言存在 `settings.json`（可以没有）：`{ "version": 1, "langs": ["java", "python"] }`，第一个是默认语言。网站右上角的语言菜单会读写它；没登录时存在浏览器里。
  - 从力扣同步来的记录（以及补过编号的手写记录）开头的设置里有 `source: leetcode.cn`、`submission: <提交编号>`、`submittedAt`。手写记录时如果对应某次力扣提交，也照着写上编号，同步时就不会再导入一份。
  - 网站练习区（题目页右侧的编辑器）也写进度仓：「测试全部」每次记一条尝试记录（开头 `source: practice`、`mode: leetcode|acm`、`ranAt`，结果按本站用例判，同步不拿它们去和力扣提交对），全部通过再存成题解（ACM 模式写法名 `ACM`；已有的题解一个都不动：和某份已有题解代码一样（`codeKey`）就不存，文件名被占了存成 `.2`、`.3` / `.ACM2`），状态只升不降；Ctrl+S 和停下 60 秒的自动保存写草稿 `drafts/<语言>/<四位题号>.<题名>[.ACM].<后缀>`。路径和内容由 `site/lib/practice/record.ts` 按规则生成，接口是 `/api/progress/practice`，页面上经 `site/lib/practice/save-queue.ts` 排队发（一次一个、草稿合并、失败重试、页面关掉时 keepalive 发完）。测试 `node site/lib/practice/test/record.test.ts`。
  - 规则以模板仓的 README 为准，模板仓的 `scripts/check.mjs`、`internal/progress/`、`site/lib/sync/core.ts` 和 `site/lib/practice/record.ts` 按同一套规则读写文件，改规则时几处一起改（进度仓里的 README 和 check.mjs 是模板的副本，也要同步）。
- 「从力扣同步」的约定：
  - **进度仓是唯一的数据源**（Phase 2 起通过 `cd-api` 的 Postgres/Valkey 热存储提供毫秒级读写，再由 `GitSyncWorker` 异步合并 commit 归档回用户进度仓，冷启动按 `Hydrator` 自动回填）。每次同步都会核对仓内提交，按 `submission` 编号判断导入过没有；用户取消勾选的提交记进 `attempts/skip.txt`；状态只升不降。
  - 流程：用户在 leetcode.cn 上点「同步力扣」书签（`site/lib/sync/bookmarklet.ts`），书签打开本站 `/sync/`，同步页用 postMessage 让力扣页面代发只读查询（`bridge.ts`），在浏览器里算出要写的内容；用户确认后，`/api/sync/commit`（由 `cd-api` 经 `site/functions/_lib/bff.ts` 代理执行）用用户自己的 GitHub 登录写成一个 commit。
  - 书签只认本站同步页的消息、只转发只读查询（带 mutation 的拒绝）；同步页只认 `https://leetcode.cn` 的回复。`/api/sync/commit` 只能写 `progress.json`、`attempts/skip.txt` 和符合规则的尝试记录，在 `internal/progress/` 与 `site/lib/sync/server.ts` 里逐个检查。
  - **以力扣为准找提交**：每次同步先用 `submissionList`（`questionSlug` 传空串）从新到旧翻完全部提交，按题目名对到热题 100（对不上时再用 `userProgressQuestionList` 里的 slug 对；这个接口限流很严，被拒就只按名字对）；只给仓库里没有的提交读代码，最近提交的题先读。列表翻到一半一直被限流，就用已经读到的最新那部分；读代码读到一半一直被限流就停下，读完的题可以先写。进度仓不支持的语言导不进记录，但结果算进状态。历史提交拿不到失败用例。实测的限流数据（一次最多读了多少、被拦下后隔多久能再读）记在 `site/lib/sync/限流记录.md`，调同步节奏前先看，有新的同步数据就补进去。
- 登录和开通：登录走 GitHub App `coding-dance`（权限：Contents 读写、Metadata 只读、Repository creation、Starring），由 `cmd/cd-api`（`internal/api/auth.go`）处理 OAuth/安装回调，Edge 层由 `site/functions/_lib/bff.ts`（`CD_API_UPSTREAM`）或 `NEXT_PUBLIC_API_BASE_URL` 统一承接。界面上统一叫「授权」，不说「安装 App」。新用户登录后回调会接着跳到授权页；授权完，回调发现进度仓还不能用（没建、或者不在授权范围里），就先落在开通页 `/welcome/?return=<原来的页面>`（`site/components/onboarding.tsx`）：选私有 / 公开（默认私有），一键建进度仓（`/api/progress/create`，用模板生成）并 Star，建好自动回到原来的页面。开通页上没授权的先去授权（回来还是开通页）；老的授权没有建仓库权限、或者用户想只授权一个仓库时，走手动两步（自己去 GitHub 建仓库，再把它放进授权范围）。首页不放开通卡片，只给跳过了开通页的人留一行提醒（`SetupReminder`）；账号菜单、同步页、题目页的「去开通」都指向开通页。私有仓库在授权之前网站看不到，不能靠「仓库存在不存在」判断用户走到了哪一步（判断「能不能用」要看仓库在不在授权范围里）。
- 网站有三个域名（leetcode.cgent.link、codexdance.cn、codingdance.cn）。Phase 2 起认证、进度、设置、题解、同步与运行统一汇聚到 `cd-api` BFF（同源走 `site/functions/_lib/bff.ts` 反向代理，或通过 `NEXT_PUBLIC_API_BASE_URL` 配合 `SITE_ORIGINS` CORS / `COOKIE_DOMAIN` 共享 Cookie），并配合 Valkey/KV `fam:<family>` 对 GitHub 单次使用 refresh token 做并发去重（测试见 `site/functions/_lib/test/bff.test.ts` 与 `internal/api/api_test.go`）。不要改成 iframe / 第三方 Cookie 的做法（浏览器已经挡掉）。
- 网站读私有资源仓用的 GitHub 令牌只存在 Cloudflare Pages 的加密环境变量 `GITHUB_TOKEN` 里；登录用的 GitHub App 的 client id / client secret 和会话加密密钥 `SESSION_SECRET` 也只存在加密环境变量里（App 的 slug 是公开信息，写在 wrangler.toml 的 `GITHUB_APP_SLUG`）；调用远端运行器的签名密钥 `RUNNER_SECRET`（和虚拟机里 `/etc/lc-runner.env` 的同一个值）、Cloudflare Access 服务令牌 `RUNNER_ACCESS_ID` / `RUNNER_ACCESS_SECRET` 同样只放加密环境变量，运行器集群的节点表 `RUNNER_NODES` 是公开的、写在 wrangler.toml。绝不写进仓库、`site/wrangler.toml`、前端代码或任何响应。改网站代码后的部署方式见 `site/README.md`。
- 图解 artifact 的配色：页面背景浅色模式用纯白 `#ffffff`、深色模式用纯黑 `#000000`，面板底色同样用纯白 / 纯黑；边框、次要文字等中性色用不带色相的纯灰，不要带淡蓝等色调。强调色和表示含义的颜色（如岛屿数量里代表水的蓝色）不受此限。
