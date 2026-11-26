import { clean } from "./session.ts";

export type HintLevel = "L1" | "L2" | "L3" | "L4";
export type CoachIntent = "hint" | "debug" | "review" | "acm_io" | "chat";

export interface ProblemCoachContext {
  topic?: string;
  level?: string;
  lede?: string;
  hints?: { t: string; body: string }[];
  points?: { t: string; body: string }[];
  acm_io?: string;
}

export interface FailedCaseContext {
  label?: string;
  input?: string;
  expected?: string;
  actual?: string;
  error?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachRequestBody {
  hint_level?: HintLevel;
  intent?: CoachIntent;
  mode?: "leetcode" | "acm";
  problem_id?: string;
  problem_title?: string;
  language?: string;
  code?: string;
  error_output?: string;
  question?: string;
  history?: ChatTurn[];
  problem_context?: ProblemCoachContext;
  failed_case?: FailedCaseContext;
}

export interface CoachOutput {
  hint_level: HintLevel;
  source: string;
  engine: "llm" | "context_coach";
  title: string;
  hint: string;
  next_steps: string[];
  quick_replies?: string[];
  available_levels: HintLevel[];
}

export interface CoachLlmEnv {
  LLM_API_KEY?: string;
  LLM_API_BASE?: string;
  LLM_MODEL?: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
}

function stripTags(s: string): string {
  return s
    .replace(/<code>(.*?)<\/code>/gi, "`$1`")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasCoachContext(body: Record<string, unknown>): boolean {
  return Boolean(
    (body.problem_context && typeof body.problem_context === "object") ||
      (body.failed_case && typeof body.failed_case === "object") ||
      typeof body.intent === "string" ||
      typeof body.question === "string",
  );
}

/** 从用户代码 + 报错 + 失败用例提取具体可感知的代码诊断信号（不依靠空洞模板）。 */
function diagnoseCodeSignals(
  code: string,
  language: string,
  mode: "leetcode" | "acm",
  err: string,
  failed?: FailedCaseContext,
): string[] {
  const notes: string[] = [];
  const trimmed = code.trim();
  const nonCommentLines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));

  if (!trimmed || nonCommentLines.length <= 2) {
    notes.push("编辑器里目前还只有函数骨架（还没写主体逻辑），先从最核心的一步状态或边界开始写起。");
  }

  // 检查 Python / JS / C++ / Java / Go 中常见未 return 或空函数体
  if (/^\s*(pass|return\s*;?\s*|\{\s*\})\s*$/m.test(trimmed) && !/\breturn\s+\S+/m.test(trimmed)) {
    notes.push("代码里还没有明确的返回结果（`return`）或输出语句，函数可能会默认返回 `null` / `None`。");
  }

  // Python `.sort()` 返回 None 的经典坑
  if (language === "python" && /\breturn\s+\w+\.sort\(/.test(trimmed)) {
    notes.push("Python 的 `list.sort()` 是原地排序，返回值是 `None`；如果需要返回有序列表，应先 `.sort()` 再返回变量，或使用 `sorted(...)`。");
  }

  // 同一个数组两层全范围遍历自配对陷阱
  const nestedFor = trimmed.match(/for\s+(\w+)\s+in\s+range\(len\((\w+)\)\):[\s\S]{0,120}?for\s+(\w+)\s+in\s+range\(len\(\2\)\):/);
  if (nestedFor && !new RegExp(`${nestedFor[1]}\\s*!=\\s*${nestedFor[3]}|${nestedFor[3]}\\s*!=\\s*${nestedFor[1]}`).test(trimmed)) {
    notes.push(
      `内层循环 \`for ${nestedFor[3]} in range(len(${nestedFor[2]}))\` 从 0 开始，当 \`${nestedFor[1]} == ${nestedFor[3]}\` 时会把同一个元素重复使用两次（例如目标是 6 时 \`3 + 3 = 6\`）。`,
    );
  } else if (/for\s*\([\s\S]*for\s*\(|for\s+.+:\s*\n[\s\S]{0,160}for\s+/.test(trimmed)) {
    notes.push("当前写法包含嵌套循环，如果题目数据规模达到 `10^4 ~ 10^5`，需要注意时间复杂度是否超出限制。");
  }

  // ACM 模式下忘记读取标准输入或忘记打印
  if (mode === "acm") {
    const hasInput =
      language === "python"
        ? /\b(sys\.stdin|input\s*\()/.test(trimmed)
        : language === "javascript" || language === "typescript"
          ? /\breadFileSync\b|\breadline\b/.test(trimmed)
          : language === "java"
            ? /\b(Scanner|BufferedReader|System\.in)\b/.test(trimmed)
            : language === "cpp" || language === "c"
              ? /\b(cin|scanf|getline|fgets)\b/.test(trimmed)
              : language === "go"
                ? /\b(fmt\.Scan|bufio\.)\b/.test(trimmed)
                : true;
    if (!hasInput) {
      notes.push("你正处于 **ACM 完整 I/O 模式**，但代码里还没有读取 `stdin`（标准输入）；ACM 下需要自己按行读入并构建数组/链表/树。");
    }
    const debugPrintCount = (trimmed.match(/\b(print\s*\(|console\.log\s*\(|System\.out\.print|fmt\.Print|cout\s*<<)/g) || []).length;
    if (debugPrintCount > 2) {
      notes.push("ACM 模式会把所有标准输出当作最终答案比对，留意不要留下调试用的 `print` / `console.log` 多余输出。");
    }
  }

  // 报错文本解析
  const lowerErr = err.toLowerCase();
  if (/indexerror|index out of|out of bounds|arrayindexoutofbounds/.test(lowerErr)) {
    notes.push("触发了下标越界：检查空数组、单元素边界，或循环条件里 `i + 1`、`left <= right` 越过边界的位置。");
  } else if (/keyerror|nullpointer|attributeerror|nonetype|cannot read propert|nil pointer|undefined/.test(lowerErr)) {
    notes.push("出现空指针 / 缺键访问：链表/树遍历中访问 `.next`/`.left`/`.val` 前要先判空，哈希表取值前要用 `.get()` 或判存在。");
  } else if (/超时|timeout|time limit/.test(lowerErr)) {
    notes.push("运行超时：检查是否有死循环（如双指针未移动、`while` 条件没推进）或时间复杂度过高。");
  } else if (/输入提前结束|长度必须是非负整数|多余内容/.test(err)) {
    notes.push("ACM 输入/输出格式和题面约定没对齐：确认数组/树先读或先输出了长度行 `n`，并且当 `n = 0` 时没有多余空行。");
  }

  // 用例对比分析
  if (failed && (failed.expected || failed.actual)) {
    const exp = (failed.expected ?? "").trim();
    const act = (failed.actual ?? "").trim();
    if (act === "null" || act === "undefined" || act === "None" || act === "（无输出）") {
      notes.push(`用例${failed.label ? `「${failed.label}」` : ""}期望 \`${exp}\`，但你的代码输出了空值 \`${act}\`——确认分支路径末尾是否漏了返回或打印。`);
    } else if (exp && act && exp !== act) {
      notes.push(`在${failed.label ? `「${failed.label}」` : "该失败用例"}中，输入 \`${(failed.input ?? "").slice(0, 72)}\` 期望 \`${exp}\`，实际得到 \`${act}\`。`);
    }
  }

  return notes;
}

/** 无外部 LLM 时基于题库语义 + 代码静态诊断的本地智能助教。 */
export function synthesizeContextCoach(req: CoachRequestBody): CoachOutput {
  const level: HintLevel = req.hint_level ?? "L1";
  const intent: CoachIntent = req.intent ?? "hint";
  const mode = req.mode ?? "leetcode";
  const title = req.problem_title || `第 ${req.problem_id || "?"} 题`;
  const lang = req.language || "python";
  const code = req.code || "";
  const err = req.error_output || req.failed_case?.error || "";
  const ctx = req.problem_context ?? {};
  const hints = (ctx.hints ?? []).map((h) => ({ t: h.t, body: stripTags(h.body) }));
  const points = (ctx.points ?? []).map((p) => ({ t: p.t, body: stripTags(p.body) }));
  const lede = ctx.lede ? stripTags(ctx.lede) : "";
  const signals = diagnoseCodeSignals(code, lang, mode, err, req.failed_case);

  const defaultReplies =
    mode === "acm"
      ? ["这题 ACM 输入输出怎么写？", "分析一下我的代码哪里不对", "这题有哪些容易踩的坑？"]
      : ["分析一下我当前代码的错因", "还有更优的复杂度做法吗？", "这题最容易漏掉哪个边界？"];

  // 1) AC 后的主动代码点评与复杂度探讨
  if (intent === "review") {
    const firstPoint = points[0] ? `核心注意事项「${points[0].t}」：${points[0].body}` : "";
    const complexityPoint = points.find((p) => /复杂度|O\(/.test(p.t + p.body));
    const lines = [
      `太棒了，「${title}」用 ${lang} 已经全部通过！`,
      ...(complexityPoint ? [`**复杂度对齐**：${complexityPoint.body}`] : lede ? [`**思路对照**：${lede}`] : []),
      ...(firstPoint && firstPoint !== complexityPoint?.body ? [`**写法检查**：${firstPoint}`] : []),
      ...(mode === "leetcode"
        ? ["如果想进一步检验大厂笔试手感，可以点顶栏切换到 **ACM** 模式自己写一遍 `stdin / stdout` 读写。"]
        : ["ACM 模式下已经完整跑通读写与边界校验，干得漂亮！"]),
    ];
    return {
      hint_level: "L4",
      source: "context_coach",
      engine: "context_coach",
      title: `AC 点评 · ${title}`,
      hint: lines.join("\n\n"),
      next_steps: [
        mode === "leetcode" ? "切到 ACM 模式练一次手写输入输出" : "试试用另一种语言或更省空间的写法再写一遍",
        "点「保存 → 存为我的题解」留档到 GitHub 进度仓",
      ],
      quick_replies: ["换一种更优空间写法", "这题在面试常怎么追问？", "总结这题的核心套路"],
      available_levels: ["L1", "L2", "L3", "L4"],
    };
  }

  // 2) ACM 读写专门辅导
  if (intent === "acm_io" || (req.question && /acm|输入|输出|stdin|stdout|读/i.test(req.question))) {
    const ioSummary = ctx.acm_io ? stripTags(ctx.acm_io) : "遵循「长度 n + 空格分隔元素」的行式编码，每次运行只处理一组用例。";
    return {
      hint_level: "L2",
      source: "context_coach",
      engine: "context_coach",
      title: `ACM 输入输出拆解 · ${title}`,
      hint: [
        `在 ACM 模式下，${lang} 需要自己从标准输入读取数据并严格按格式打印结果：`,
        ioSummary,
        ...(signals.length ? [`当前代码检测：${signals[0]}`] : []),
        "提示：右侧「题解」区也已支持切换到「**ACM 完整 I/O**」版本，卡住编码格式时可直接对照或一键填入编辑器。",
      ].join("\n\n"),
      next_steps: [
        "先把第一行/前几行输入按格式读进来并用示例验证",
        "确认不要在结果之外多打印调试日志",
      ],
      quick_replies: ["怎样读取链表或二叉树？", "帮我检查当前代码的输出格式"],
      available_levels: ["L1", "L2", "L3", "L4"],
    };
  }

  // 3) 错因诊断 / 自由追问
  if (intent === "debug" || (intent === "chat" && req.question)) {
    const q = (req.question || "").trim();
    const askingComplexity = /复杂度|优化|空间|时间|更快/.test(q);
    const askingPitfall = /坑|边界|错|漏|注意/.test(q);
    const askingInterview = /面试|追问|套路|为什么/.test(q);

    const paragraphs: string[] = [];
    if (q) paragraphs.push(`收到你的问题：**${q}**`);

    if (askingComplexity && points.length) {
      const cp = points.find((p) => /复杂度|空间|O\(/.test(p.t + p.body));
      paragraphs.push(cp ? `**复杂度与优化**：${cp.body}` : `**核心思路**：${lede || points[0].body}`);
    } else if (askingPitfall && points.length) {
      paragraphs.push("**本题高频踩坑点**：\n" + points.map((p) => `- **${p.t}**：${p.body}`).join("\n"));
    } else if (askingInterview && lede) {
      paragraphs.push(`**面试高频切入点**：${lede}`);
      if (points[0]) paragraphs.push(`面试官常顺着「**${points[0].t}**」继续追问边界和空间优化：${points[0].body}`);
    } else {
      if (signals.length) {
        paragraphs.push("**针对你当前代码的排查**：\n" + signals.map((s) => `- ${s}`).join("\n"));
      }
      if (hints[0]) {
        paragraphs.push(`**核心方向参考**：${hints[0].t} — ${hints[0].body}`);
      } else if (lede) {
        paragraphs.push(`**解题切入点**：${lede}`);
      }
      if (points[0] && signals.length === 0) {
        paragraphs.push(`**易错提醒（${points[0].t}）**：${points[0].body}`);
      }
    }

    if (paragraphs.length <= 1) {
      paragraphs.push(`建议先对照「${title}」的示例手动走一遍每一步状态更新，重点核对循环起止下标与返回值类型。`);
    }

    return {
      hint_level: level,
      source: "context_coach",
      engine: "context_coach",
      title: intent === "debug" ? `错因诊断 · ${title}` : `小舞解答 · ${title}`,
      hint: paragraphs.join("\n\n"),
      next_steps: [
        req.failed_case?.label ? `重点拿「${req.failed_case.label}」手动跟踪一遍` : "点击运行按钮旁的「调试」单步观察变量",
        level !== "L4" ? "如需更具体的代码骨架，可切换上方的 L2 / L3 提示" : "修改后重新点击运行测试",
      ],
      quick_replies: defaultReplies,
      available_levels: ["L1", "L2", "L3", "L4"],
    };
  }

  // 4) L1–L4 渐进提示（直接结合题目 hints + points + lede + 代码扫描）
  if (level === "L1") {
    const h1 = hints[0];
    const parts = [
      h1 ? `**${h1.t}**\n${h1.body}` : lede || `先思考「${title}」需要维护什么不变量，再决定用哪种数据结构记录中间状态。`,
      ...(signals[0] ? [`顺便帮你扫了一眼代码：${signals[0]}`] : []),
    ];
    return {
      hint_level: "L1",
      source: "context_coach",
      engine: "context_coach",
      title: `L1 方向引导 · ${title}`,
      hint: parts.join("\n\n"),
      next_steps: ["先顺着这个思路手推 1 组简单输入", "想看具体条件与边界线索可点 L2"],
      quick_replies: defaultReplies,
      available_levels: ["L1", "L2", "L3", "L4"],
    };
  }

  if (level === "L2") {
    const h2 = hints[1] || hints[0];
    const p0 = points[0];
    const parts = [
      h2 ? `**${h2.t}**\n${h2.body}` : lede || `关键在于理清状态转移和数据结构中存的键与值分别代表什么。`,
      ...(p0 ? [`**容易漏掉的条件（${p0.t}）**：${p0.body}`] : []),
      ...(signals.length ? [`**代码信号**：${signals[0]}`] : []),
    ];
    return {
      hint_level: "L2",
      source: "context_coach",
      engine: "context_coach",
      title: `L2 边界与数据结构 · ${title}`,
      hint: parts.join("\n\n"),
      next_steps: ["对照空输入 / 单元素 / 重复值检验条件", "需要分步骨架可点 L3"],
      quick_replies: defaultReplies,
      available_levels: ["L1", "L2", "L3", "L4"],
    };
  }

  if (level === "L3") {
    const h3 = hints[2] || hints[1] || hints[0];
    const bodyList = hints.map((h, i) => `${i + 1}. **${h.t}**：${h.body}`).join("\n");
    return {
      hint_level: "L3",
      source: "context_coach",
      engine: "context_coach",
      title: `L3 解题骨架 · ${title}`,
      hint: [
        lede ? `**核心方法**：${lede}` : h3 ? `**关键步骤**：${h3.body}` : "",
        bodyList ? `**执行步骤拆解**：\n${bodyList}` : "",
        ...(signals.length ? [`**当前代码注意点**：\n${signals.map((s) => `- ${s}`).join("\n")}`] : []),
      ]
        .filter(Boolean)
        .join("\n\n"),
      next_steps: ["按上述步骤补全当前函数并跑一遍精简边界测试", "需要完整易错点清单可点 L4"],
      quick_replies: defaultReplies,
      available_levels: ["L1", "L2", "L3", "L4"],
    };
  }

  // L4: 完整排查与注意事项总结
  return {
    hint_level: "L4",
    source: "context_coach",
    engine: "context_coach",
    title: `L4 完整诊断与避坑指南 · ${title}`,
    hint: [
      ...(signals.length ? [`**你的代码诊断**：\n${signals.map((s) => `- ${s}`).join("\n")}`] : []),
      ...(lede ? [`**最优思路概览**：${lede}`] : []),
      ...(points.length ? [`**关键核对清单**：\n${points.map((p) => `- **${p.t}**：${p.body}`).join("\n")}`] : []),
    ].join("\n\n") || `核对「${title}」的状态转移顺序、边界判空与时间复杂度后重新提交。`,
    next_steps: ["先用单步调试在出错行打断点核对变量", "确认全部边界用例通过后再运行全量测试"],
    quick_replies: defaultReplies,
    available_levels: ["L1", "L2", "L3", "L4"],
  };
}

function buildLlmSystemPrompt(req: CoachRequestBody): string {
  const mode = req.mode === "acm" ? "ACM 完整 stdin/stdout 模式" : "LeetCode 核心代码模式";
  const levelDesc: Record<HintLevel, string> = {
    L1: "L1（不剧透方向提问，给思考切入点，绝不写完整代码）",
    L2: "L2（指出关键数据结构与遗漏边界/不变量，不直接贴完整答案）",
    L3: "L3（给出清晰的分步逻辑骨架与复杂度分析，可带简短伪代码）",
    L4: "L4（完整根因排查、指出代码具体 bug 行并给出优化方案）",
  };
  return [
    "你是「小舞」，CodingDance 热题 100 在线刷题平台的像素风格 AI 编程助教。",
    "你的风格：聪明、活泼、精准、不废话、像一位并肩刷题的靠谱学长/学姐，严格遵守教学渐进性。",
    `当前模式：${mode}，语言：${req.language || "python"}，提示层级：${levelDesc[req.hint_level ?? "L1"]}。`,
    "回答要求：",
    "1. 直接结合用户的代码、当前报错、失败用例和题目背景给出针对性反馈，绝不说放之四海而皆准的空话。",
    "2. 若用户在追问某个报错或错因，精准定位到变量名、循环下标、I/O 编码或边界条件。",
    "3. 控制在 220 字以内，善用加粗和行内代码，并务必返回合法 JSON 对象：{\"title\": string, \"hint\": string, \"next_steps\": string[], \"quick_replies\": string[]}（quick_replies 给 2~3 条简短追问建议）。",
  ].join("\n");
}

function buildLlmUserPrompt(req: CoachRequestBody): string {
  const ctx = req.problem_context;
  const parts = [
    `题目：${req.problem_title || req.problem_id || "未知"} (${ctx?.topic || "算法"} / ${ctx?.level || ""})`,
    ...(ctx?.lede ? [`参考思路摘要：${stripTags(ctx.lede)}`] : []),
    ...(ctx?.points?.length ? [`常见注意事项：${ctx.points.map((p) => `${p.t}: ${stripTags(p.body)}`).join("；")}`] : []),
    ...(ctx?.acm_io ? [`ACM I/O 说明：${stripTags(ctx.acm_io)}`] : []),
    `用户当前代码：\n\`\`\`${req.language || ""}\n${(req.code || "").slice(0, 6000)}\n\`\`\``,
    ...(req.error_output ? [`运行报错：${req.error_output.slice(0, 1000)}`] : []),
    ...(req.failed_case
      ? [
          `失败用例（${req.failed_case.label || "测试"}）：输入=${req.failed_case.input || ""} | 期望=${req.failed_case.expected || ""} | 实际=${req.failed_case.actual || ""}`,
        ]
      : []),
    ...(req.history?.length
      ? [`最近对话：\n${req.history.slice(-4).map((t) => `${t.role === "user" ? "用户" : "小舞"}：${t.content}`).join("\n")}`]
      : []),
    ...(req.question ? [`用户本次提问：${req.question}`] : [`用户点击请求 ${req.hint_level || "L1"} 指导（意图：${req.intent || "hint"}）。`]),
  ];
  return parts.join("\n\n");
}

function parseLlmJson(raw: string, fallback: CoachOutput, level: HintLevel): CoachOutput {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { title?: string; hint?: string; next_steps?: string[]; quick_replies?: string[] };
      if (parsed.hint && typeof parsed.hint === "string") {
        return {
          hint_level: level,
          source: "llm_coach",
          engine: "llm",
          title: parsed.title || fallback.title,
          hint: parsed.hint.trim(),
          next_steps: Array.isArray(parsed.next_steps) && parsed.next_steps.length ? parsed.next_steps.slice(0, 3) : fallback.next_steps,
          quick_replies: Array.isArray(parsed.quick_replies) && parsed.quick_replies.length ? parsed.quick_replies.slice(0, 3) : fallback.quick_replies,
          available_levels: ["L1", "L2", "L3", "L4"],
        };
      }
    } catch {
      /* fall through to plain text */
    }
  }
  const cleanText = raw.trim();
  if (!cleanText) return fallback;
  return {
    hint_level: level,
    source: "llm_coach",
    engine: "llm",
    title: fallback.title,
    hint: cleanText,
    next_steps: fallback.next_steps,
    quick_replies: fallback.quick_replies,
    available_levels: ["L1", "L2", "L3", "L4"],
  };
}

export function llmConfigured(env: CoachLlmEnv): boolean {
  return Boolean(clean(env.LLM_API_KEY) || env.AI);
}

/**
 * 调用真实大模型（OpenAI 兼容接口或 Cloudflare Workers AI 绑定）。
 * 若未配置或上游超时/失败，则自动优雅退回本地上下文诊断助教（synthesizeContextCoach）。
 */
export async function callCompanionLlm(
  env: CoachLlmEnv,
  req: CoachRequestBody,
  fetchImpl: typeof fetch = fetch,
): Promise<CoachOutput> {
  const fallback = synthesizeContextCoach(req);
  const level: HintLevel = req.hint_level ?? "L1";
  const system = buildLlmSystemPrompt(req);
  const user = buildLlmUserPrompt(req);
  const apiKey = clean(env.LLM_API_KEY);

  if (apiKey) {
    const base = (clean(env.LLM_API_BASE) || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = clean(env.LLM_MODEL) || "gpt-4o-mini";
    try {
      const res = await fetchImpl(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 550,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = json.choices?.[0]?.message?.content;
        if (content) return parseLlmJson(content, fallback, level);
      }
    } catch {
      /* fallback below */
    }
  }

  if (env.AI) {
    try {
      const model = clean(env.LLM_MODEL) || "@cf/qwen/qwen2.5-coder-32b-instruct";
      const result = (await env.AI.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 550,
        temperature: 0.4,
      })) as { response?: string };
      if (result?.response) return parseLlmJson(result.response, fallback, level);
    } catch {
      /* fallback below */
    }
  }

  return fallback;
}
