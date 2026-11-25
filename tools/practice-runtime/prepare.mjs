import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Phase 4: 当配置了 NEXT_PUBLIC_RUNTIME_BASE_URL（R2 / CDN 分发）或 CI 未安装本地 pyodide 大包时，
// 构建直接按 site/public/practice-runtime/manifest.json 解析版本化远端地址，不再强依赖搬运 node_modules。
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const modules = resolve(root, "site/node_modules");
const vendor = resolve(root, "site/public/practice-runtime/vendor");

if (process.env.NEXT_PUBLIC_RUNTIME_BASE_URL) {
  console.log(`Using remote R2/CDN practice runtimes (${process.env.NEXT_PUBLIC_RUNTIME_BASE_URL}); skipping local vendor copy.`);
  process.exit(0);
}

const pyPkg = resolve(modules, "pyodide/package.json");
const tsPkg = resolve(modules, "typescript/package.json");
if (!existsSync(pyPkg) || !existsSync(tsPkg)) {
  console.log("Local pyodide/typescript packages not installed; relying on manifest.json runtime URLs.");
  process.exit(0);
}

const version = async (pkgPath) => JSON.parse(await readFile(pkgPath, "utf8")).version;
const pyodide = resolve(vendor, "pyodide", await version(pyPkg));
const typescript = resolve(vendor, "typescript", await version(tsPkg));
await rm(vendor, { recursive: true, force: true });
await mkdir(pyodide, { recursive: true });
await mkdir(typescript, { recursive: true });
for (const file of ["pyodide.js", "pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  await copyFile(resolve(modules, "pyodide", file), resolve(pyodide, file));
}
await copyFile(resolve(modules, "typescript/lib/typescript.js"), resolve(typescript, "typescript.js"));
console.log("Prepared local Python and TypeScript browser runtimes.");
