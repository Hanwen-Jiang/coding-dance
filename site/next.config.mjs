import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出到 out/，由 Cloudflare Pages 托管；数据在运行时由 functions/ 里的 Pages Functions 从 GitHub 读取
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // 练习运行环境的版本号：tools/practice-runtime/prepare.mjs 按它把 Pyodide 和 TypeScript 复制到
  // public/practice-runtime/vendor/<包名>/<版本>/，路径带版本才能长期缓存
  env: {
    PRACTICE_PYODIDE_VERSION: require("pyodide/package.json").version,
    PRACTICE_TYPESCRIPT_VERSION: require("typescript/package.json").version,
  },
};

export default nextConfig;
