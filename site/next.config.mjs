import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出到 out/，由 Cloudflare Pages 托管；数据在运行时由 functions/ 里的 Pages Functions 从 GitHub 读取
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // 静态资源（/_next/static 下的 JS、CSS、字体）的地址前缀，构建时用环境变量 ASSET_PREFIX 指定，默认为空（和页面同域）。
  // 以后要把它们放到国内 CDN / 对象存储时设成那个域名，比如 ASSET_PREFIX=https://static.example.cn；
  // 那边要怎么配（跨域、类型、缓存、上传顺序、备案）见 site/README.md「静态资源放到别的域名」
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  // 练习运行环境的版本号：tools/practice-runtime/prepare.mjs 按它把 Pyodide 和 TypeScript 复制到
  // public/practice-runtime/vendor/<包名>/<版本>/，路径带版本才能长期缓存
  env: {
    PRACTICE_PYODIDE_VERSION: require("pyodide/package.json").version,
    PRACTICE_TYPESCRIPT_VERSION: require("typescript/package.json").version,
  },
};

export default nextConfig;
