import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const modules = resolve(root, "site/node_modules");
const vendor = resolve(root, "site/public/practice-runtime/vendor");
const version = async (name) => JSON.parse(await readFile(resolve(modules, name, "package.json"), "utf8")).version;

// 路径里带版本号（site/public/_headers 给 vendor/ 一年的 immutable 缓存）。
// 网站按同样的规则拼路径：版本号由 site/next.config.mjs 从同一份 node_modules 读出来、构建时写进 lib/practice/runner.ts。
const pyodide = resolve(vendor, "pyodide", await version("pyodide"));
const typescript = resolve(vendor, "typescript", await version("typescript"));
await rm(vendor, { recursive: true, force: true });
await mkdir(pyodide, { recursive: true });
await mkdir(typescript, { recursive: true });
for (const file of ["pyodide.js", "pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  await copyFile(resolve(modules, "pyodide", file), resolve(pyodide, file));
}
await copyFile(resolve(modules, "typescript/lib/typescript.js"), resolve(typescript, "typescript.js"));
console.log("Prepared local Python and TypeScript browser runtimes.");
