# 仓库约定

力扣「热题 100」的**资源仓**：只放不变的题目资源，人人看到的都一样。个人进度和自己写的题解放在各自的**进度仓**里（模板 `Hanwen-Jiang/hot100-progress-template`，我的是 `Hanwen-Jiang/hot100-progress`）。

## 目录

- `problems/<编号>.<题名>.md`：题目文档，一题一份，含难度、专题、重要程度、原题和图解链接。不写个人状态。
- `illustrations/<编号>.<题名>.html`：解题思路图解。
- `studyplan/热题100.md`（按专题的题单）、`studyplan/优先级清单.md`（100 题按重要程度排序，Hot 20 重点 / P0 必做 / P1 重要 / P2 补全 / P3 选做）。网站按这两个文件解析题单和重要程度，改表格格式时要同步改 `site/functions/_lib/repo.ts`。
- `tools/`：小工具。图解生成器在 `tools/illustrations/`：`specs/`（每题一份 spec，Python 代码写在里面）、`code/<四位题号>/<key>.<后缀>`（其他语言的题解）、`cases/`（判题用例，build 导出）、`judge/`（判题器）、`data/`（导出给网站的数据）。「数据结构与算法基础」专题在 `topics/<slug>.js`，其他语言的代码在 `code/topics/<slug>/`，导出到 `data/topics/` 和 `cases/topics/`。
- `.github/workflows/verify.yml`：CI。每次 push 重新 build 并核对生成的文件和提交的一致，再把六种语言的每段题解编译、运行、对答案。
- `site/`：题解网站（Next.js 静态导出 + HeroUI Pro，部署在 Cloudflare Pages 项目 `lc-hot100`，域名 https://leetcode.cgent.link）。网站在运行时通过 GitHub API 读这个仓库，push 之后最多一分钟网站就会更新，不用重新部署。登录的用户的进度和题解从他自己的 `hot100-progress` 仓库读写。
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
- **每段代码都要过判题**。spec 里写 `sig`（函数名、参数类型、返回类型；设计类题写类和方法，写法见 `judge/util.js`；要按「是不是同一个节点」判的题用 `CycleList`、`JoinList`、`NodeIndex`、`TreeRef`、`TreeVal`、`RandomList` 这几种类型，见 141、142、160、236、138）和 `call(args, H)`（把演示的输入变成力扣的参数列表，`H` 是 `makeR()` 的工具函数），需要的边界用例写在 `cases` 里。build 把用例导出到 `cases/<四位题号>.json`（预设 + `cases` + 10 组固定种子的随机输入，期望输出由 Python 标准解法算出）。`node tools/illustrations/judge/run.js [--lang java,cpp] [题号…]` 逐个编译运行并对答案：本机跑 Python、Go、JavaScript、TypeScript（TypeScript 的 `--strict` 类型检查要设 `TSC=<typescript/bin/tsc 的路径>`），Java 和 C++ 靠 CI。
- 改题解代码的流程：在 `multilang` 分支上改 → 本机 `build.js` 和 `judge/run.js` 通过 → push 分支，等 CI 六种语言全绿 → 合进 main。不要把没过 CI 的代码直接 push 到 main（网站实时读 main）。
- 每份 spec 的 `codes` 里第一段是标准解法；再放一段 `kind: "elegant"` 的简洁 Python 写法（标准解法本身已经足够简洁时，直接给第一段标 `kind: "elegant"`）。
- 演示的「随机」输入写在 `tools/illustrations/random.js` 的 `GEN[题号]` 里：返回 `{ args, note, py, cmp }`，规模控制在演示看得过来的范围内，并满足题目约束（有唯一解、数组有序等）。`py` 是用标准解法算同一输入的 Python 表达式（辅助函数在 `random_prelude.py`），build 时每题随机 40 组，演示答案必须和它一致。新增或改动演示的输入格式时要同步改这里。
- `build.js` 会同时把提示、代码、注意点和演示导出到 `tools/illustrations/data/<编号>.json`，网站读的就是这份数据，所以改完 spec 一定要重新 build 并提交 data 目录。只想更新数据、不跑测试时用 `node tools/illustrations/build.js --data-only`。没装 Python 时可以设 `PYTHON="node <pyodide 运行器>"` 替代。
- 题目页的「练习」（浏览器里写代码、运行、测试，力扣模式和 ACM 模式）用的数据在 `tools/practice/data/<四位编号>.json`，由 `node tools/practice/build.cjs` 从 spec、判题用例和题面里的官方示例生成（要 Python），网站经 `/api/practice/<题号>` 运行时读。改了 spec、`cases/` 或题面之后重新生成并提交；CI 会重新生成一遍，和提交的不一致就失败。`node tools/practice/test.cjs` 检查数据，`node tools/practice-runtime/test.mjs` 检查运行器（要 `site/node_modules` 里有 pyodide 和 typescript）。
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
  - 通过后把整理好的写法按 `solutions/<语言>/<四位题号>.<题名>[.<写法>].<后缀>` 存一份。
  - 常用语言存在 `settings.json`（可以没有）：`{ "version": 1, "langs": ["java", "python"] }`，第一个是默认语言。网站右上角的语言菜单会读写它；没登录时存在浏览器里。
  - 从力扣同步来的记录（以及补过编号的手写记录）开头的设置里有 `source: leetcode.cn`、`submission: <提交编号>`、`submittedAt`。手写记录时如果对应某次力扣提交，也照着写上编号，同步时就不会再导入一份。
  - 网站练习区（题目页右侧的编辑器）也写进度仓：「测试全部」每次记一条尝试记录（开头 `source: practice`、`mode: leetcode|acm`、`ranAt`，结果按本站用例判，同步不拿它们去和力扣提交对），全部通过再存成题解（ACM 模式写法名 `ACM`），状态只升不降；Ctrl+S 和停下 60 秒的自动保存写草稿 `drafts/<语言>/<四位题号>.<题名>[.ACM].<后缀>`。路径和内容由 `site/lib/practice/record.ts` 按规则生成，接口是 `/api/progress/practice`，页面上经 `site/lib/practice/save-queue.ts` 排队发（一次一个、草稿合并、失败重试、页面关掉时 keepalive 发完）。测试 `node site/lib/practice/test/record.test.ts`。
  - 规则以模板仓的 README 为准，模板仓的 `scripts/check.mjs`、网站 `site/functions/_lib/progress.ts`、`site/lib/sync/core.ts` 和 `site/lib/practice/record.ts` 按同一套规则读写文件，改规则时几处一起改（进度仓里的 README 和 check.mjs 是模板的副本，也要同步）。
- 「从力扣同步」的约定：
  - **进度仓是唯一的数据源**。网站不另存任何数据，每次同步都重新读仓库，按 `submission` 编号判断导入过没有；用户取消勾选的提交记进 `attempts/skip.txt`；状态只升不降。
  - 流程：用户在 leetcode.cn 上点「同步力扣」书签（`site/lib/sync/bookmarklet.ts`），书签打开本站 `/sync/`，同步页用 postMessage 让力扣页面代发只读查询（`bridge.ts`），在浏览器里算出要写的内容；用户确认后，`/api/sync/commit` 用用户自己的 GitHub 登录写成一个 commit。网站服务器只转手，不保存。
  - 书签只认本站同步页的消息、只转发只读查询（带 mutation 的拒绝）；同步页只认 `https://leetcode.cn` 的回复。`/api/sync/commit` 只能写 `progress.json`、`attempts/skip.txt` 和符合规则的尝试记录，在 `site/lib/sync/server.ts` 里逐个检查。
  - **以力扣为准找提交**：每次同步先用 `submissionList`（`questionSlug` 传空串）从新到旧翻完全部提交，按题目名对到热题 100（对不上时再用 `userProgressQuestionList` 里的 slug 对；这个接口限流很严，被拒就只按名字对）；只给仓库里没有的提交读代码，最近提交的题先读。列表翻到一半一直被限流，就用已经读到的最新那部分；读代码读到一半一直被限流就停下，读完的题可以先写。进度仓不支持的语言导不进记录，但结果算进状态。历史提交拿不到失败用例。实测的限流数据（一次最多读了多少、被拦下后隔多久能再读）记在 `site/lib/sync/限流记录.md`，调同步节奏前先看，有新的同步数据就补进去。
- 登录和开通：登录走 GitHub App `hot-100`（权限：Contents 读写、Metadata 只读、Repository creation、Starring）。界面上统一叫「授权」，不说「安装 App」。新用户登录后回调会接着跳到授权页；回到网站后在首页一键建进度仓（`/api/progress/create`，用模板生成，私有或公开由用户选，默认私有）并 Star。老的授权没有建仓库权限、或者用户想只授权一个仓库时，走手动两步（自己去 GitHub 建仓库，再把它放进授权范围）。私有仓库在授权之前网站看不到，不能靠「仓库存在不存在」判断用户走到了哪一步。
- 网站读私有资源仓用的 GitHub 令牌只存在 Cloudflare Pages 的加密环境变量 `GITHUB_TOKEN` 里；登录用的 GitHub App 的 client id / client secret 和会话加密密钥 `SESSION_SECRET` 也只存在加密环境变量里（App 的 slug 是公开信息，写在 wrangler.toml 的 `GITHUB_APP_SLUG`）。绝不写进仓库、`site/wrangler.toml`、前端代码或任何响应。改网站代码后的部署方式见 `site/README.md`。
- 图解 artifact 的配色：页面背景浅色模式用纯白 `#ffffff`、深色模式用纯黑 `#000000`，面板底色同样用纯白 / 纯黑；边框、次要文字等中性色用不带色相的纯灰，不要带淡蓝等色调。强调色和表示含义的颜色（如岛屿数量里代表水的蓝色）不受此限。
