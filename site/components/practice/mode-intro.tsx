"use client";

import { Button, Chip, Modal } from "@heroui/react";
import clsx from "clsx";
import { useId } from "react";

import { CodeIcon, DocIcon } from "@/components/icons";
import type { PracticeMode } from "@/lib/practice/types";

export const MODE_INTRO_SEEN_KEY = "hot100:practice:mode-intro-v1";

export function markModeIntroSeen() {
  try {
    localStorage.setItem(MODE_INTRO_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function shouldShowModeIntro(): boolean {
  try {
    return localStorage.getItem(MODE_INTRO_SEEN_KEY) !== "1";
  } catch {
    return false;
  }
}

const LEETCODE_PREVIEW = `class Solution:
    def twoSum(self, nums, target):
        # 只写核心函数，I/O 由判题器接管
        return [i, j]`;

const ACM_PREVIEW = `import sys
# 自行从 stdin 解析输入，并按格式 print 到 stdout
nums = list(map(int, sys.stdin.readline().split()))
print(ans)`;

/**
 * 首次进入题目页（或点击模式旁的「?」按钮）展示的 LeetCode 核心代码模式 vs ACM 完整 I/O 模式对比弹框。
 */
export function ModeIntroModal({
  open,
  currentMode,
  onOpenChange,
  onPickMode,
}: {
  open: boolean;
  currentMode: PracticeMode;
  onOpenChange: (next: boolean) => void;
  onPickMode: (mode: PracticeMode, openWorkbench: boolean) => void;
}) {
  const descId = useId();
  const dismiss = () => {
    markModeIntroSeen();
    onOpenChange(false);
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) markModeIntroSeen();
        onOpenChange(next);
      }}
    >
      <Button aria-hidden className="sr-only" isDisabled>
        模式说明
      </Button>
      <Modal.Backdrop style={{ zIndex: 140 }}>
        <Modal.Container placement="center" size="lg">
          <div
            className="contents"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                dismiss();
              }
            }}
          >
            <Modal.Dialog aria-describedby={descId} data-testid="practice-mode-intro-modal">
              <Modal.Header className="flex flex-col gap-1.5">
                <span className="font-pixel text-[10px] tracking-[0.18em] text-accent">
                  TWO PRACTICE MODES · 双模式指南
                </span>
                <Modal.Heading className="text-lg font-bold sm:text-xl">
                  同一道题，两种练习模式怎么选？
                </Modal.Heading>
                <p className="text-xs leading-5 text-muted" id={descId}>
                  本站的练习区、题解与 100 道题的测试用例同时支持这两种模式，随时可以在题面右上角或编辑器顶栏一键切换。
                </p>
              </Modal.Header>

              <Modal.Body className="flex flex-col gap-4">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {/* LeetCode 核心代码模式 */}
                  <div
                    className={clsx(
                      "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
                      currentMode === "leetcode"
                        ? "border-accent/60 bg-accent/[0.04]"
                        : "border-border bg-foreground/[0.015]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-accent/15 text-accent">
                          <CodeIcon height={14} width={14} />
                        </span>
                        <span className="text-sm font-bold">LeetCode 核心代码</span>
                      </div>
                      <Chip color="accent" size="sm" variant="soft">
                        日常刷题推荐
                      </Chip>
                    </div>
                    <p className="text-xs leading-5 text-muted">
                      只需补全给定的 <code className="font-mono text-foreground">Solution</code> 方法，链表、二叉树节点与标准输入输出由判题环境自动构造与比对。
                    </p>
                    <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-muted">
                      <li>聚焦算法思想与状态转移，上手零负担</li>
                      <li>内置函数签名模板与原地修改判定</li>
                      <li>支持断点单步调试与变量追踪</li>
                    </ul>
                    <pre className="mt-auto overflow-x-auto rounded-xl border border-separator bg-surface px-3 py-2.5 font-mono text-[11px] leading-5 text-foreground/90">
                      {LEETCODE_PREVIEW}
                    </pre>
                  </div>

                  {/* ACM 完整 I/O 模式 */}
                  <div
                    className={clsx(
                      "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
                      currentMode === "acm"
                        ? "border-warning/60 bg-warning/[0.04]"
                        : "border-border bg-foreground/[0.015]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-warning/15 text-warning">
                          <DocIcon height={14} width={14} />
                        </span>
                        <span className="text-sm font-bold">ACM 完整 I/O</span>
                      </div>
                      <Chip color="warning" size="sm" variant="soft">
                        笔试 / 机试实战
                      </Chip>
                    </div>
                    <p className="text-xs leading-5 text-muted">
                      像牛客 / Codeforces / 大厂笔试一样编写完整可运行程序，自行从 <code className="font-mono text-foreground">stdin</code> 读取并构造数据结构，结果输出到 <code className="font-mono text-foreground">stdout</code>。
                    </p>
                    <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-muted">
                      <li>题面自动展开标准输入 / 输出编码格式与样例</li>
                      <li>官方题解可一键切换 ACM 完整读写版本参考</li>
                      <li>练熟快速读入、建树建表，告别笔试「只会核心代码」</li>
                    </ul>
                    <pre className="mt-auto overflow-x-auto rounded-xl border border-separator bg-surface px-3 py-2.5 font-mono text-[11px] leading-5 text-foreground/90">
                      {ACM_PREVIEW}
                    </pre>
                  </div>
                </div>
              </Modal.Body>

              <Modal.Footer className="flex flex-wrap items-center justify-between gap-2">
                <Button onPress={dismiss} size="sm" variant="ghost">
                  先看看题面
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onPress={() => {
                      markModeIntroSeen();
                      onPickMode("acm", true);
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    体验 ACM 笔试模式
                  </Button>
                  <Button
                    autoFocus
                    onPress={() => {
                      markModeIntroSeen();
                      onPickMode("leetcode", true);
                    }}
                    size="sm"
                    variant="primary"
                  >
                    从 LeetCode 模式开始
                  </Button>
                </div>
              </Modal.Footer>
            </Modal.Dialog>
          </div>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
