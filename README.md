# 热题 100 资源仓

力扣「[热题 100](https://leetcode.cn/studyplan/top-100-liked/)」的**不变的资源**：100 道题的题目文档、分层提示、简洁写法和标准解法、逐步动画演示，以及按重要程度排好的刷题顺序。

网站：**https://codingdance.cn** —— 按重要程度 / 难度 / 题型浏览，每道题一页。另有「[数据结构与算法基础](https://codingdance.cn/learn/)」：22 个专题（链表、二叉树、堆、并查集……二分、排序、BFS / DFS、回溯、动态规划……），讲解 + 逐步演示 + 六种语言的代码 + 相关热题。

## 资源仓和进度仓

| 仓库 | 放什么 | 谁的 |
| --- | --- | --- |
| 这个仓库 | 题目、提示、题解、演示、重要程度。所有人看到的都一样 | 公共 |
| [hot100-progress-template](https://github.com/Hanwen-Jiang/hot100-progress-template) | 0 进度的进度仓模板，以及进度和题解文件的存储规则 | 模板 |
| `<你的账号>/hot100-progress` | 你自己每道题的状态和你写的题解 | 每人一个 |

在网站上用 GitHub 登录后，网站会用模板在你的账号下创建 `hot100-progress`，之后读写的都是你自己的进度仓。我自己的在 [Hanwen-Jiang/hot100-progress](https://github.com/Hanwen-Jiang/hot100-progress)。

## 目录结构

```
.
├── problems/        # 题目文档，一题一份：<编号>.<题名>.md（图片在 problems/images/）
├── illustrations/   # 思路图解页面：<编号>.<题名>.html，索引见 illustrations/README.md
├── studyplan/
│   ├── 热题100.md        # 按专题分组的题单
│   └── 优先级清单.md      # 100 题按重要程度排序（Hot 20 重点 → P0 必做 → P3 选做）
├── tools/           # 小工具（TreeGraph.py：二叉树可视化；illustrations/：图解生成器，data/ 是导出给网站的数据，topics/ 是基础专题）
└── site/            # 题解网站（Next.js + HeroUI Pro，部署在 Cloudflare Pages）
```

接下来要做的「在线练习」（浏览器里编译运行六种语言、调试、云端运行）见 [ROADMAP.md](ROADMAP.md)，欢迎认领任务。

## 备注

- 题目文档中的题面文本取自开源仓库 [doocs/leetcode](https://github.com/doocs/leetcode)，版权归力扣所有。
- 个人做题记录和以前的题解已经迁到 [Hanwen-Jiang/hot100-progress](https://github.com/Hanwen-Jiang/hot100-progress)，这个仓库的 git 历史里也还留着。
