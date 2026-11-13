# 仓库约定

LeetCode 刷题仓库，当前按力扣「热题 100」推进。

## 目录

- `problems/<编号>.<题名>.md`：题目文档，一题一份，含状态、优先级、本地题解和图解链接。
- `solutions/<java|python|go>/<编号>.<题名>.<后缀>`：题解。同一题的多种写法用 `<编号>.<题名>.<写法>.<后缀>`，如 `0200.岛屿数量.BFS.py`。
- `illustrations/<编号>.<题名>.html`：解题思路图解。
- `studyplan/热题100.md`（进度）、`studyplan/优先级清单.md`（刷题顺序，暂不含困难题）。
- `notes/`、`tools/`：笔记和小工具。

## 工作约定

- 为某道题做的解法图解 / 提示类 artifact，都要把 HTML 源文件存进 `illustrations/`，并在该题的题目文档里加「思路图解」一节，写上本地文件和在线 artifact 链接。存进仓库的文件第一行加 `<meta charset="utf-8">`，保证本地打开不乱码。
- 图解用 `tools/illustrations/` 生成（200、215、236 三份是手写的）：每题写一份 `specs/<编号>.js`，运行 `node tools/illustrations/build.js <题号>`。构建会自动核对演示答案并测试页面里的 Python 代码。发布后把链接记进 `tools/illustrations/artifacts.json`，并更新 `illustrations/README.md` 索引。
- 修改已发布的图解时，用题目文档里记录的 artifact 链接原地更新，不要新建一个链接。
- 题目通过后：保存题解到 `solutions/`，并同步更新 `studyplan/热题100.md`（状态、概览计数、题解链接）、`studyplan/优先级清单.md`、题目文档和 README 的题解索引与收录数量。
- 图解 artifact 的配色：页面背景浅色模式用纯白 `#ffffff`、深色模式用纯黑 `#000000`，面板底色同样用纯白 / 纯黑；边框、次要文字等中性色用不带色相的纯灰，不要带淡蓝等色调。强调色和表示含义的颜色（如岛屿数量里代表水的蓝色）不受此限。
