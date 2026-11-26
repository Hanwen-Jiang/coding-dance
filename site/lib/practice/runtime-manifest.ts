// Shared WASM runtime manifest types and versioned URL resolution for browser practice sandboxes.
// Used by site/lib/practice/runner.ts (NEXT_PUBLIC_RUNTIME_BASE_URL -> R2 CDN or local vendor/ fallback).

export interface RuntimeFileIntegrity {
  bytes: number;
  sha256: string;
}

export interface RuntimeSpec {
  version: string;
  path: string;
  entry?: string;
  files?: string[];
  integrity?: Record<string, RuntimeFileIntegrity>;
  uncompressedBytes?: number;
  compressedBytes?: number;
  distribution?: string;
  status?: string;
}

export interface PracticeRuntimeManifest {
  schemaVersion: number;
  defaultVendorPrefix: string;
  runtimes: {
    pyodide: RuntimeSpec;
    typescript: RuntimeSpec;
    [name: string]: RuntimeSpec;
  };
}

export interface ResolvedRuntimeVendorUrls {
  pyodide: string;
  typescript: string;
}

export function resolveRuntimeVendorUrls(
  manifest: PracticeRuntimeManifest,
  opts?: {
    baseUrl?: string;
    pyodideVersion?: string;
    typescriptVersion?: string;
  },
): ResolvedRuntimeVendorUrls {
  const rawBase = opts?.baseUrl?.trim();
  const prefix = rawBase
    ? `${rawBase.replace(/\/+$/, "")}/`
    : (manifest.defaultVendorPrefix || "vendor/").replace(/^\/+/, "");

  const pyVer = opts?.pyodideVersion?.trim() || manifest.runtimes.pyodide.version;
  const tsVer = opts?.typescriptVersion?.trim() || manifest.runtimes.typescript.version;
  const tsEntry = manifest.runtimes.typescript.entry || "typescript.js";

  return {
    pyodide: `${prefix}pyodide/${pyVer}/`,
    typescript: `${prefix}typescript/${tsVer}/${tsEntry}`,
  };
}
