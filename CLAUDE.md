# 仓库约定

力扣「热题 100」的**资源仓**：只放不变的题目资源，人人看到的都一样。个人进度和自己写的题解放在各自的**进度仓**里（模板 `Hanwen-Jiang/hot100-progress-template`，我的是 `Hanwen-Jiang/hot100-progress`）。

## 目录

- `problems/<编号>.<题名>.md`：题目文档，一题一份，含难度、专题、重要程度、原题和图解链接。不写个人状态。
- `illustrations/<编号>.<题名>.html`：解题思路图解。
- `studyplan/热题100.md`（按专题的题单）、`studyplan/优先级清单.md`（100 题按重要程度排序，P0 必做 / P1 重要 / P2 补全 / P3 选做）。网站按这两个文件解析题单和重要程度，改表格格式时要同步改 `site/functions/_lib/repo.ts`。
- `tools/`：小工具。
- `site/`：题解网站（Next.js 静态导出 + HeroUI Pro，部署在 Cloudflare Pages 项目 `lc-hot100`，域名 https://leetcode.cgent.link）。网站在运行时通过 GitHub API 读这个仓库，push 之后最多一分钟网站就会更新，不用重新部署。登录的用户的进度和题解从他自己的 `hot100-progress` 仓库读写。

## 工作约定

- 为某道题做的解法图解 / 提示类 artifact，都要把 HTML 源文件存进 `illustrations/`，并在该题的题目文档里加「思路图解」一节，写上本地文件和在线 artifact 链接。存进仓库的文件第一行加 `<meta charset="utf-8">`，保证本地打开不乱码。
- 图解用 `tools/illustrations/` 生成：每题写一份 `specs/<编号>.js`，运行 `node tools/illustrations/build.js <题号>`。构建会自动核对演示答案并测试页面里的 Python 代码。发布后把链接记进 `tools/illustrations/artifacts.json`，并更新 `illustrations/README.md` 索引。
- 每份 spec 的 `codes` 里第一段是标准解法；再放一段 `kind: "elegant"` 的简洁 Python 写法（标准解法本身已经足够简洁时，直接给第一段标 `kind: "elegant"`）。
- 演示的「随机」输入写在 `tools/illustrations/random.js` 的 `GEN[题号]` 里：返回 `{ args, note, py, cmp }`，规模控制在演示看得过来的范围内，并满足题目约束（有唯一解、数组有序等）。`py` 是用标准解法算同一输入的 Python 表达式（辅助函数在 `random_prelude.py`），build 时每题随机 40 组，演示答案必须和它一致。新增或改动演示的输入格式时要同步改这里。
- `build.js` 会同时把提示、代码、注意点和演示导出到 `tools/illustrations/data/<编号>.json`，网站读的就是这份数据，所以改完 spec 一定要重新 build 并提交 data 目录。只想更新数据、不跑测试时用 `node tools/illustrations/build.js --data-only`。没装 Python 时可以设 `PYTHON="node <pyodide 运行器>"` 替代。
- 修改已发布的图解时，用题目文档里记录的 artifact 链接原地更新，不要新建一个链接。
- 题目通过后：不改这个仓库。在自己的进度仓里把 `progress.json` 对应题号的 `status` 改成 `已通过`（网站上点一下也行），题解按 `solutions/<语言>/<四位题号>.<题名>[.<写法>].<后缀>` 存进进度仓。规则以模板仓的 README 为准，模板仓的 `scripts/check.mjs` 和网站 `site/functions/_lib/progress.ts` 按同一套规则读文件，改规则时三处一起改。
- 网站读私有资源仓用的 GitHub 令牌只存在 Cloudflare Pages 的加密环境变量 `GITHUB_TOKEN` 里；GitHub OAuth 的 client secret 和会话加密密钥 `SESSION_SECRET` 也只存在加密环境变量里。绝不写进仓库、`site/wrangler.toml`、前端代码或任何响应。改网站代码后的部署方式见 `site/README.md`。
- 图解 artifact 的配色：页面背景浅色模式用纯白 `#ffffff`、深色模式用纯黑 `#000000`，面板底色同样用纯白 / 纯黑；边框、次要文字等中性色用不带色相的纯灰，不要带淡蓝等色调。强调色和表示含义的颜色（如岛屿数量里代表水的蓝色）不受此限。
