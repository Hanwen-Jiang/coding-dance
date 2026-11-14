"use client";

import { Button, Card } from "@heroui/react";
import NextLink from "next/link";

import { PixelBullet } from "@/components/pixel";
import { useProgress } from "@/lib/progress";

function H2({ children, en }: { children: React.ReactNode; en: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-bold">
      <PixelBullet />
      {children}
      <span className="font-pixel text-[10px] font-normal tracking-widest text-muted">{en}</span>
    </h2>
  );
}

const FLOW = [
  { from: "你的浏览器", to: "leetcode.cn", what: "在你已经登录的力扣标签页里，读你的提交记录和代码" },
  { from: "你的浏览器", to: "你的 GitHub 进度仓", what: "你确认后，把新的尝试记录和状态写成一个 commit" },
  { from: "本站", to: "你的 GitHub 进度仓", what: "只读：题目页的「尝试记录」和首页的进度都从这里来" },
];

const PERMS: [string, string][] = [
  ["leetcode.cn", "在力扣的标签页里发读取请求（提交列表、代码）。用的是浏览器现成的登录状态，扩展拿不到你的 Cookie"],
  ["github.com、api.github.com", "设备授权登录 GitHub，读写你的进度仓"],
  ["scripting", "把读取请求放进力扣的标签页里执行"],
  ["storage", "在本机保存 GitHub 授权（8 小时自动续期，6 个月后要重新连接）。不保存任何做题数据"],
];

export function SyncGuide() {
  const { session } = useProgress();
  const repo = session?.repo;
  const repoName = repo?.name ?? `你的账号/${session?.repoName ?? "hot100-progress"}`;
  return (
    <div className="flex flex-col gap-10 pt-10 sm:pt-14">
      <section className="flex flex-col gap-3">
        <span className="font-pixel text-[11px] tracking-[0.2em] text-accent">SYNC · LEETCODE.CN → GITHUB</span>
        <h1 className="text-3xl font-bold">从力扣同步提交记录</h1>
        <p className="max-w-2xl text-[15px] leading-7 text-muted">
          用 Hot 100 同步扩展，把你在力扣中国站上的每一次提交（通过的和没通过的）写进你自己的进度仓。网站上的「尝试记录」和题目状态都从那个仓库读。
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <a className="no-underline" download href="/hot100-sync.zip">
            <Button>下载扩展（hot100-sync.zip）</Button>
          </a>
          {!repo?.exists && (
            <NextLink className="text-sm" href="/">
              还没有进度仓？先在首页按两步开通
            </NextLink>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <H2 en="DATA FLOW">数据怎么走</H2>
        <div className="grid gap-3 md:grid-cols-3">
          {FLOW.map((f) => (
            <Card key={f.what} className="gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span>{f.from}</span>
                <span className="font-pixel text-[10px] text-accent">→</span>
                <span>{f.to}</span>
              </div>
              <p className="text-sm leading-6 text-muted">{f.what}</p>
            </Card>
          ))}
        </div>
        <p className="text-sm leading-6 text-muted">
          没有第四条路：你的力扣数据不会经过本站的服务器，也不会发到其他任何地方。
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <H2 en="SOURCE OF TRUTH">进度仓是唯一的数据源</H2>
        <Card className="gap-2 p-5 text-[15px] leading-7">
          <p>
            <span className="font-mono text-sm">{repoName}</span> 里的文件就是全部数据。扩展本地不留副本，每次同步都重新读一遍仓库，靠每条记录里写的力扣提交编号判断哪些已经导入过。
          </p>
          <p>
            你在仓库里改掉的记录以仓库为准，扩展不会改回去。同步前可以取消勾选不想导入的提交，它们的编号会记进
            <span className="font-mono text-sm"> attempts/skip.txt</span>，以后不再列出来；删掉一条同步来的记录时，把它的编号写进这个文件，它就不会被导回来。
          </p>
          <p>
            手写的记录（比如带分析的「错在哪里」）不会被重复导入：代码和某次力扣提交一样，就认定是同一次，只在它开头的设置里补上
            <span className="font-mono text-sm"> submission </span>编号，其余内容一个字不动。
          </p>
          <p>状态只升不降：有通过的提交记「已通过」，只提交过没通过记「尝试过」；你手动标的「曾通过」只有在那之后又通过了才会改。</p>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <H2 en="INSTALL">安装</H2>
        <Card className="p-5">
          <ol className="flex list-decimal flex-col gap-2 ps-5 text-[15px] leading-7">
            <li>下载 <span className="font-mono text-sm">hot100-sync.zip</span>，解压。</li>
            <li>
              在 Chrome 打开 <span className="font-mono text-sm">chrome://extensions</span>（Edge 是 <span className="font-mono text-sm">edge://extensions</span>），打开右上角的「开发者模式」。
            </li>
            <li>点「加载已解压的扩展程序」，选解压出来的 <span className="font-mono text-sm">hot100-sync</span> 文件夹。</li>
            <li>点工具栏上的扩展图标，打开同步页面：连接 GitHub → 确认力扣已登录 → 检查要同步的内容 → 勾选要导入的提交 → 确认写入。</li>
            <li>第一次同步要读你所有的提交，力扣限流比较严，扩展会放慢速度，可能要十几分钟；要是中途被拒，可以先写入已经读完的题，之后再同步剩下的。</li>
          </ol>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <H2 en="PERMISSIONS">扩展要的权限</H2>
        <Card className="p-0">
          <table className="w-full text-sm">
            <tbody>
              {PERMS.map(([k, v]) => (
                <tr key={k} className="border-b border-separator last:border-0">
                  <td className="w-48 px-4 py-3 align-top font-mono text-xs">{k}</td>
                  <td className="px-4 py-3 leading-6 text-muted">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <H2 en="WHAT IS WRITTEN">会写进仓库的内容</H2>
        <Card className="gap-3 p-5 text-[15px] leading-7">
          <p>
            每次提交一个文件：<span className="font-mono text-sm">attempts/&lt;四位题号&gt;.&lt;题名&gt;/&lt;日期&gt;.&lt;序号&gt;.&lt;结果&gt;.md</span>，内容是原样代码和力扣的判题结果（通过了几个用例、用时、内存）。
            日期按北京时间，同一天的序号接着已有的记录往后排。
          </p>
          <p>
            「错在哪里」「怎么发现的」这些分析扩展不会替你写，可以之后自己在文件里补上。力扣上历史提交的失败用例拿不到，所以记录里只有通过了几个用例。
          </p>
          <p>只同步热题 100 里的题，只同步进度仓支持的 11 种语言。</p>
        </Card>
      </section>
    </div>
  );
}
