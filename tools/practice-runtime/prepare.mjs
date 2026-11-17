import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const vendor = resolve(root, "site/public/practice-runtime/vendor");
await mkdir(resolve(vendor, "pyodide"), { recursive: true });
for (const file of ["pyodide.js", "pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  await copyFile(resolve(root, "site/node_modules/pyodide", file), resolve(vendor, "pyodide", file));
}
await copyFile(resolve(root, "site/node_modules/typescript/lib/typescript.js"), resolve(vendor, "typescript.js"));
console.log("Prepared local Python and TypeScript browser runtimes.");
