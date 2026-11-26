// node lib/practice/test/runtime-manifest.test.ts: verifies WASM runtime manifest schema, SHA-256 integrity, and R2/vendor URL resolution
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveRuntimeVendorUrls } from "../runtime-manifest.ts";
import type { PracticeRuntimeManifest, RuntimeFileIntegrity } from "../runtime-manifest.ts";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = path.join(siteDir, "public/practice-runtime/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PracticeRuntimeManifest;

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.defaultVendorPrefix, "vendor/");

// All 5 runtimes declared cleanly
for (const key of ["pyodide", "typescript", "clang-wasm", "go-wasm", "teavm-javac"]) {
  assert(manifest.runtimes[key], `manifest missing runtime entry: ${key}`);
  assert.equal(typeof manifest.runtimes[key].version, "string");
  assert.equal(typeof manifest.runtimes[key].path, "string");
}

// Per-file SHA-256 integrity entries exist for shipped browser runtimes
for (const [name, modSubdir] of [
  ["pyodide", "pyodide"],
  ["typescript", "typescript/lib"],
] as const) {
  const spec = manifest.runtimes[name];
  assert(Array.isArray(spec.files) && spec.files.length > 0, `${name} files list missing`);
  assert(spec.integrity, `${name} integrity map missing`);
  const integrity = spec.integrity;
  for (const f of spec.files) {
    const entry: RuntimeFileIntegrity | undefined = integrity[f];
    assert(entry, `${name} missing integrity for ${f}`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${name}/${f} sha256 must be 64-hex`);
    assert(entry.bytes > 0, `${name}/${f} bytes must be > 0`);

    const localFile = path.join(siteDir, "node_modules", modSubdir, f);
    if (existsSync(localFile)) {
      const buf = readFileSync(localFile);
      assert.equal(buf.length, entry.bytes, `${name}/${f} installed bytes mismatch`);
      const digest = crypto.createHash("sha256").update(new Uint8Array(buf)).digest("hex");
      assert.equal(digest, entry.sha256, `${name}/${f} installed sha256 mismatch`);
    }
  }
}

// Offline default URL resolution
assert.deepEqual(resolveRuntimeVendorUrls(manifest), {
  pyodide: `vendor/pyodide/${manifest.runtimes.pyodide.version}/`,
  typescript: `vendor/typescript/${manifest.runtimes.typescript.version}/typescript.js`,
});

// R2 CDN URL resolution (with and without trailing slash)
for (const baseUrl of ["https://assets.codingdance.cn/practice-runtime/vendor", "https://assets.codingdance.cn/practice-runtime/vendor/"]) {
  assert.deepEqual(resolveRuntimeVendorUrls(manifest, { baseUrl }), {
    pyodide: `https://assets.codingdance.cn/practice-runtime/vendor/pyodide/${manifest.runtimes.pyodide.version}/`,
    typescript: `https://assets.codingdance.cn/practice-runtime/vendor/typescript/${manifest.runtimes.typescript.version}/typescript.js`,
  });
}

// Version override resolution
assert.deepEqual(resolveRuntimeVendorUrls(manifest, { pyodideVersion: "9.9.9", typescriptVersion: "6.0.0" }), {
  pyodide: "vendor/pyodide/9.9.9/",
  typescript: "vendor/typescript/6.0.0/typescript.js",
});

console.log("WASM runtime manifest schema, SHA-256 integrity, and URL resolution verified.");
