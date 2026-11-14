# 仓库约定

力扣「热题 100」的**资源仓**：只放不变的题目资源，人人看到的都一样。个人进度和自己写的题解放在各自的**进度仓**里（模板 `Hanwen-Jiang/hot100-progress-template`，我的是 `Hanwen-Jiang/hot100-progress`）。

## 目录

- `problems/<编号>.<题名>.md`：题目文档，一题一份，含难度、专题、重要程度、原题和图解链接。不写个人状态。
- `illustrations/<编号>.<题名>.html`：解题思路图解。
- `studyplan/热题100.md`（按专题的题单）、`studyplan/优先级清单.md`（100 题按重要程度排序，Hot 20 重点 / P0 必做 / P1 重要 / P2 补全 / P3 选做）。网站按这两个文件解析题单和重要程度，改表格格式时要同步改 `site/functions/_lib/repo.ts`。
- `tools/`：小工具。
- `site/`：题解网站（Next.js 静态导出 + HeroUI Pro，部署在 Cloudflare Pages 项目 `lc-hot100`，域名 https://leetcode.cgent.link）。网站在运行时通过 GitHub API 读这个仓库，push 之后最多一分钟网站就会更新，不用重新部署。登录的用户的进度和题解从他自己的 `hot100-progress` 仓库读写。
- `site/lib/sync/`：「从力扣同步」的逻辑（网站 `/sync/` 页面用）：把用户在 leetcode.cn 上的提交记录写进他自己的进度仓。测试在 `site/lib/sync/test/`，在 `site/` 里运行 `npm test`（`node lib/sync/test/sync.test.ts`）。

## 工作约定

- 为某道题做的解法图解 / 提示类 artifact，都要把 HTML 源文件存进 `illustrations/`，并在该题的题目文档里加「思路图解」一节，写上本地文件和在线 artifact 链接。存进仓库的文件第一行加 `<meta charset="utf-8">`，保证本地打开不乱码。
- 图解用 `tools/illustrations/` 生成：每题写一份 `specs/<编号>.js`，运行 `node tools/illustrations/build.js <题号>`。构建会自动核对演示答案并测试页面里的 Python 代码。发布后把链接记进 `tools/illustrations/artifacts.json`，并更新 `illustrations/README.md` 索引。
- 一道题有几种真正不同的解法时，演示也做几种，网站和图解页上可以切换：spec 自己的 `build` 是第一种（`method` 写它的名字，要和标准解法对应），其余放进 `alts: [{ t, note, legend, build }]`，每种都要在 `codes` 里有对应的代码。所有解法共用 `presets` 和随机输入，build 会逐个核对答案。只是写法不同（切片、内置函数、滚动数组）的不另做。不同解法给出的结果顺序可能不一样时，spec 里加 `cmp: "unordered"`。
- 每份 spec 的 `codes` 里第一段是标准解法；再放一段 `kind: "elegant"` 的简洁 Python 写法（标准解法本身已经足够简洁时，直接给第一段标 `kind: "elegant"`）。
- 演示的「随机」输入写在 `tools/illustrations/random.js` 的 `GEN[题号]` 里：返回 `{ args, note, py, cmp }`，规模控制在演示看得过来的范围内，并满足题目约束（有唯一解、数组有序等）。`py` 是用标准解法算同一输入的 Python 表达式（辅助函数在 `random_prelude.py`），build 时每题随机 40 组，演示答案必须和它一致。新增或改动演示的输入格式时要同步改这里。
- `build.js` 会同时把提示、代码、注意点和演示导出到 `tools/illustrations/data/<编号>.json`，网站读的就是这份数据，所以改完 spec 一定要重新 build 并提交 data 目录。只想更新数据、不跑测试时用 `node tools/illustrations/build.js --data-only`。没装 Python 时可以设 `PYTHON="node <pyodide 运行器>"` 替代。
- 修改已发布的图解时，用题目文档里记录的 artifact 链接原地更新，不要新建一个链接。
- 做题记录不改这个仓库，都存进自己的进度仓：
  - 每一次值得记的尝试（通过、答案错误、超时、运行出错、思路不成立）都按 `attempts/<四位题号>.<题名>/<YYYY-MM-DD>.<序号>.<结果>.md` 记一份：原样代码（不要改好再存；不是原样时写 `verbatim: false`）、错在哪里、怎么发现的、差在哪一步。写进去的结论先在本地复现一遍。
  - 状态写在 `progress.json` 对应题号的 `status`：通过了记 `已通过`，提交过但还没通过记 `尝试过`（网站上点一下也行）。
  - 通过后把整理好的写法按 `solutions/<语言>/<四位题号>.<题名>[.<写法>].<后缀>` 存一份。
  - 从力扣同步来的记录（以及补过编号的手写记录）开头的设置里有 `source: leetcode.cn`、`submission: <提交编号>`、`submittedAt`。手写记录时如果对应某次力扣提交，也照着写上编号，同步时就不会再导入一份。
  - 规则以模板仓的 README 为准，模板仓的 `scripts/check.mjs`、网站 `site/functions/_lib/progress.ts` 和 `site/lib/sync/core.ts` 按同一套规则读写文件，改规则时几处一起改（进度仓里的 README 和 check.mjs 是模板的副本，也要同步）。
- 「从力扣同步」的约定：
  - **进度仓是唯一的数据源**。网站不另存任何数据，每次同步都重新读仓库，按 `submission` 编号判断导入过没有；用户取消勾选的提交记进 `attempts/skip.txt`；状态只升不降。
  - 流程：用户在 leetcode.cn 上点「同步力扣」书签（`site/lib/sync/bookmarklet.ts`），书签打开本站 `/sync/`，同步页用 postMessage 让力扣页面代发只读查询（`bridge.ts`），在浏览器里算出要写的内容；用户确认后，`/api/sync/commit` 用用户自己的 GitHub 登录写成一个 commit。网站服务器只转手，不保存。
  - 书签只认本站同步页的消息、只转发只读查询（带 mutation 的拒绝）；同步页只认 `https://leetcode.cn` 的回复。`/api/sync/commit` 只能写 `progress.json`、`attempts/skip.txt` 和符合规则的尝试记录，在 `site/lib/sync/server.ts` 里逐个检查。
  - 力扣中国站的 `userProgressQuestionList`（做过的题）限流很严，被限流时改成逐题查 `submissionList`；读到一半一直被限流就停下，读完的题可以先写。历史提交拿不到失败用例。实测的限流数据（一次最多读了多少、被拦下后隔多久能再读）记在 `site/lib/sync/限流记录.md`，调同步节奏前先看，有新的同步数据就补进去。
- 网站读私有资源仓用的 GitHub 令牌只存在 Cloudflare Pages 的加密环境变量 `GITHUB_TOKEN` 里；登录用的 GitHub App 的 client id / client secret 和会话加密密钥 `SESSION_SECRET` 也只存在加密环境变量里（App 的 slug 是公开信息，写在 wrangler.toml 的 `GITHUB_APP_SLUG`）。绝不写进仓库、`site/wrangler.toml`、前端代码或任何响应。改网站代码后的部署方式见 `site/README.md`。
- 图解 artifact 的配色：页面背景浅色模式用纯白 `#ffffff`、深色模式用纯黑 `#000000`，面板底色同样用纯白 / 纯黑；边框、次要文字等中性色用不带色相的纯灰，不要带淡蓝等色调。强调色和表示含义的颜色（如岛屿数量里代表水的蓝色）不受此限。
