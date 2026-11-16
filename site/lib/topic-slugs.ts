// 基础专题的 slug，用来预先生成 /learn/<slug>/ 的静态页面外壳；内容在运行时从 /api/topic/<slug> 读取。
// 和 tools/illustrations/topics/ 里的文件一一对应（build.js 会核对），加专题时这里也要加，然后重新部署网站。
export const TOPIC_SLUGS = [
  "prefix-sum",
  "hash-table",
  "linked-list",
  "stack-queue",
  "heap",
  "binary-tree",
  "binary-search",
];
