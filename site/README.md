# 热题 100 题解网站

线上地址：https://leetcode.cgent.link （Cloudflare Pages 项目 `lc-hot100`）

- 首页按重要程度 / 难度 / 题型分组，带状态筛选和搜索，顶部的进度矩阵每格是一道题。
- 每道题一页：原题、分层提示、逐步动画演示、简洁写法和标准题解、我的历史题解、写代码时注意。

## 数据从哪来

网站本身只是静态页面，数据在运行时由 `functions/`（Cloudflare Pages Functions）通过 GitHub API 读取这个仓库：

| 网站上的内容 | 仓库里的来源 |
| --- | --- |
| 题目列表、难度、题型、状态 | `studyplan/热题100.md` |
| 重要程度（P0 / P1 / P2 / 复习 / 困难题） | `studyplan/优先级清单.md` |
| 原题 | `problems/<编号>.<题名>.md` 的「题目描述」一节，图片在 `problems/images/` |
| 分层提示、简洁写法、标准题解、注意点、动画演示 | `tools/illustrations/data/<编号>.json`（由 `tools/illustrations/build.js` 从 spec 导出） |
| 我的历史题解 | `solutions/<语言>/<编号>.*`（Java 文件只取 submit region 里的代码） |
| 手写图解（200、215、236） | `illustrations/<编号>.<题名>.html`，内嵌在题目页里 |

所以平时只要改仓库、push，网站最多一分钟后就会显示新内容（Functions 在内存里缓存 60 秒），不用重新部署。

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
