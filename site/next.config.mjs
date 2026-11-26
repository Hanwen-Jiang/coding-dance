import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Phase 4: 优先从受控 manifest.json 读取浏览器语言运行时版本；本机装了新包时自动对齐，未装包时（CI）零报错。
const manifest = JSON.parse(readFileSync(resolve(here, "public/practice-runtime/manifest.json"), "utf8"));
function pkgVersion(pkgName, fallback) {
  try {
    return require(`${pkgName}/package.json`).version || fallback;
  } catch {
    return fallback;
  }
}

// 检测 @heroui-pro/react 是否为完整授权包（公开 npm 上未授权安装的是没有 dist/components 的空壳包）。
// CI 无私有源 Token 或显式设置 HEROUI_PRO_SHIM=1 时，自动切换到仓库内置的零私有依赖兼容层。
const hasFullHeroUIPro =
  process.env.HEROUI_PRO_SHIM !== "1" &&
  existsSync(resolve(here, "node_modules/@heroui-pro/react/dist/components"));

const shimAliases = hasFullHeroUIPro
  ? {}
  : {
      "@heroui-pro/react/code-block": "./lib/ui/heroui-pro-shim/code-block.tsx",
      "@heroui-pro/react": "./lib/ui/heroui-pro-shim/index.tsx",
    };

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出到 out/，由 Cloudflare Pages 托管；数据在运行时由 cd-api / Pages Functions 提供
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  env: {
    PRACTICE_PYODIDE_VERSION: pkgVersion("pyodide", manifest.runtimes.pyodide.version),
    PRACTICE_TYPESCRIPT_VERSION: pkgVersion("typescript", manifest.runtimes.typescript.version),
  },
  ...(hasFullHeroUIPro
    ? {}
    : {
        turbopack: {
          resolveAlias: shimAliases,
        },
        webpack(config) {
          config.resolve.alias = {
            ...(config.resolve.alias || {}),
            "@heroui-pro/react/code-block": resolve(here, "lib/ui/heroui-pro-shim/code-block.tsx"),
            "@heroui-pro/react": resolve(here, "lib/ui/heroui-pro-shim/index.tsx"),
          };
          return config;
        },
      }),
};

export default nextConfig;
