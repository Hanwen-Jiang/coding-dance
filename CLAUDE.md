# 仓库约定

LeetCode 刷题仓库，当前按力扣「热题 100」推进。

## 目录

- `problems/<编号>.<题名>.md`：题目文档，一题一份，含状态、优先级、本地题解和图解链接。
- `solutions/<java|python|go>/<编号>.<题名>.<后缀>`：题解。同一题的多种写法用 `<编号>.<题名>.<写法>.<后缀>`，如 `0200.岛屿数量.BFS.py`。
- `illustrations/<编号>.<题名>.html`：解题思路图解。
- `studyplan/热题100.md`（进度）、`studyplan/优先级清单.md`（刷题顺序，暂不含困难题）。
- `notes/`、`tools/`：笔记和小工具。
- `site/`：题解网站（Next.js 静态导出 + HeroUI Pro，部署在 Cloudflare Pages 项目 `lc-hot100`，域名 https://leetcode.cgent.link）。网站在运行时通过 GitHub API 读这个仓库，仓库就是它的数据库，push 之后最多一分钟网站就会更新，不用重新部署。

## 工作约定

- 为某道题做的解法图解 / 提示类 artifact，都要把 HTML 源文件存进 `illustrations/`，并在该题的题目文档里加「思路图解」一节，写上本地文件和在线 artifact 链接。存进仓库的文件第一行加 `<meta charset="utf-8">`，保证本地打开不乱码。
- 图解用 `tools/illustrations/` 生成（200、215、236 三份是手写的）：每题写一份 `specs/<编号>.js`，运行 `node tools/illustrations/build.js <题号>`。构建会自动核对演示答案并测试页面里的 Python 代码。发布后把链接记进 `tools/illustrations/artifacts.json`，并更新 `illustrations/README.md` 索引。
- 每份 spec 的 `codes` 里第一段是标准解法；再放一段 `kind: "elegant"` 的简洁 Python 写法（标准解法本身已经足够简洁时，直接给第一段标 `kind: "elegant"`）。手写图解的题（200、215、236）的 spec 带 `handwritten: true`，只提供提示和代码，build 只跑测试，不覆盖手写页面。
- `build.js` 会同时把提示、代码、注意点和演示导出到 `tools/illustrations/data/<编号>.json`，网站读的就是这份数据，所以改完 spec 一定要重新 build 并提交 data 目录。只想更新数据、不跑测试时用 `node tools/illustrations/build.js --data-only`。没装 Python 时可以设 `PYTHON="node <pyodide 运行器>"` 替代。
- 修改已发布的图解时，用题目文档里记录的 artifact 链接原地更新，不要新建一个链接。
- 题目通过后：保存题解到 `solutions/`，并同步更新 `studyplan/热题100.md`（状态、概览计数、题解链接）、`studyplan/优先级清单.md`、题目文档和 README 的题解索引与收录数量。
- 网站读私有仓库用的 GitHub 令牌只存在 Cloudflare Pages 的加密环境变量 `GITHUB_TOKEN` 里，绝不写进仓库、`site/wrangler.toml`、前端代码或任何响应。改网站代码后的部署方式见 `site/README.md`。
- 图解 artifact 的配色：页面背景浅色模式用纯白 `#ffffff`、深色模式用纯黑 `#000000`，面板底色同样用纯白 / 纯黑；边框、次要文字等中性色用不带色相的纯灰，不要带淡蓝等色调。强调色和表示含义的颜色（如岛屿数量里代表水的蓝色）不受此限。
