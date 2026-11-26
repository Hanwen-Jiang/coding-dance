import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Phase 4: 以 site/public/practice-runtime/manifest.json 为单一真源：
// - 支持 --verify 校验本地 node_modules 与 manifest SHA-256 / 字节数完全一致；
// - 支持 --out <dir> 导出至 R2 上传目录；
// - 当设置 NEXT_PUBLIC_RUNTIME_BASE_URL 且未显式指定 --out / --force 时跳过本地 vendor 拷贝；
// - 若目标 vendor 文件已存在且 SHA-256 一致则幂等跳过。

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const modules = resolve(root, "site/node_modules");
const manifestPath = resolve(root, "site/public/practice-runtime/manifest.json");

const argv = process.argv.slice(2);
const verifyOnly = argv.includes("--verify");
const forceCopy = argv.includes("--force");
const outIdx = argv.indexOf("--out");
const customOut = outIdx >= 0 ? argv[outIdx + 1] : undefined;
if (outIdx >= 0 && !customOut) {
  console.error("Usage error: --out requires a directory path");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const vendorRoot = customOut ? resolve(root, customOut) : resolve(root, "site/public/practice-runtime/vendor");

async function fileDigest(p) {
  const [info, buf] = await Promise.all([stat(p), readFile(p)]);
  return {
    bytes: info.size,
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
  };
}

async function verifySpec(name, spec, filesWithSrc) {
  const expectedVer = spec.version;
  const pkgPath = resolve(modules, name === "pyodide" ? "pyodide/package.json" : "typescript/package.json");
  if (!existsSync(pkgPath)) {
    throw new Error(`Missing installed package for ${name} (${pkgPath})`);
  }
  const actualVer = JSON.parse(await readFile(pkgPath, "utf8")).version;
  if (actualVer !== expectedVer) {
    throw new Error(`${name} version mismatch: package.json=${actualVer}, manifest.json=${expectedVer}`);
  }
  for (const { rel, src } of filesWithSrc) {
    if (!existsSync(src)) {
      throw new Error(`Missing runtime file: ${src}`);
    }
    const want = spec.integrity?.[rel];
    if (!want) {
      throw new Error(`Manifest missing integrity entry for ${name}/${rel}`);
    }
    const got = await fileDigest(src);
    if (got.bytes !== want.bytes || got.sha256 !== want.sha256) {
      throw new Error(
        `Integrity mismatch for ${name}/${rel}: got ${got.sha256} (${got.bytes} B), expected ${want.sha256} (${want.bytes} B)`,
      );
    }
  }
}

const pySpec = manifest.runtimes.pyodide;
const tsSpec = manifest.runtimes.typescript;

const pyMappings = (pySpec.files || []).map((f) => ({
  rel: f,
  src: resolve(modules, "pyodide", f),
  destName: f,
}));
const tsMappings = (tsSpec.files || ["typescript.js"]).map((f) => ({
  rel: f,
  src: resolve(modules, "typescript/lib", f),
  destName: f,
}));

if (verifyOnly) {
  await verifySpec("pyodide", pySpec, pyMappings);
  await verifySpec("typescript", tsSpec, tsMappings);
  console.log(
    `Verified runtime manifest SHA-256 digests (${pySpec.files.length} pyodide@${pySpec.version} files, ${tsMappings.length} typescript@${tsSpec.version} file).`,
  );
  process.exit(0);
}

if (process.env.NEXT_PUBLIC_RUNTIME_BASE_URL && !customOut && !forceCopy) {
  console.log(`Using remote R2/CDN practice runtimes (${process.env.NEXT_PUBLIC_RUNTIME_BASE_URL}); skipping local vendor copy.`);
  process.exit(0);
}

const pyPkg = resolve(modules, "pyodide/package.json");
const tsPkg = resolve(modules, "typescript/package.json");
if (!existsSync(pyPkg) || !existsSync(tsPkg)) {
  console.log("Local pyodide/typescript packages not installed; relying on manifest.json runtime URLs.");
  process.exit(0);
}

const pyVer = JSON.parse(await readFile(pyPkg, "utf8")).version;
const tsVer = JSON.parse(await readFile(tsPkg, "utf8")).version;

if (pyVer === pySpec.version) await verifySpec("pyodide", pySpec, pyMappings);
if (tsVer === tsSpec.version) await verifySpec("typescript", tsSpec, tsMappings);

const pyDest = resolve(vendorRoot, "pyodide", pyVer);
const tsDest = resolve(vendorRoot, "typescript", tsVer);

async function isCacheFresh() {
  if (forceCopy || pyVer !== pySpec.version || tsVer !== tsSpec.version) return false;
  for (const m of pyMappings) {
    const dest = resolve(pyDest, m.destName);
    const want = pySpec.integrity?.[m.rel];
    if (!existsSync(dest) || !want) return false;
    const got = await fileDigest(dest);
    if (got.bytes !== want.bytes || got.sha256 !== want.sha256) return false;
  }
  for (const m of tsMappings) {
    const dest = resolve(tsDest, m.destName);
    const want = tsSpec.integrity?.[m.rel];
    if (!existsSync(dest) || !want) return false;
    const got = await fileDigest(dest);
    if (got.bytes !== want.bytes || got.sha256 !== want.sha256) return false;
  }
  return true;
}

if (await isCacheFresh()) {
  console.log(`Practice runtimes already up to date (pyodide@${pyVer}, typescript@${tsVer}, SHA-256 verified).`);
  process.exit(0);
}

await rm(vendorRoot, { recursive: true, force: true });
await mkdir(pyDest, { recursive: true });
await mkdir(tsDest, { recursive: true });
for (const m of pyMappings) {
  await copyFile(m.src, resolve(pyDest, m.destName));
}
for (const m of tsMappings) {
  await copyFile(m.src, resolve(tsDest, m.destName));
}
console.log(`Prepared local Python (${pyVer}) and TypeScript (${tsVer}) browser runtimes at ${vendorRoot}.`);
