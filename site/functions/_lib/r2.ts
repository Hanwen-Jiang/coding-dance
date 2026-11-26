// 3-tier content-addressed artifact reader for derived JSON blobs (problems, practice, topics):
// Tier 1: R2 public CDN / base URL (`env.R2_ASSETS_BASE_URL`, serves `<base>/v1/manifest.json` + immutable `<sha256>` blobs)
// Tier 2: Cloudflare Pages static ASSETS binding (`env.ASSETS`, serves `/_r2/v1/...` bundled alongside site)
// Tier 3: Return null -> caller falls back to GitHub raw/tree API (also used by local preview adapters)

import type { Env } from "./github.ts";

export interface ArtifactRef {
  path: string;
  sha256: string;
  bytes: number;
}

export interface R2Manifest {
  version: number;
  generatedAt: string;
  totalBytes: number;
  problems: Record<string, ArtifactRef>;
  practice: Record<string, ArtifactRef>;
  topics: Record<string, ArtifactRef>;
  topicsIndex?: ArtifactRef;
}

const TTL_MS = 60_000;
const manifestMemo = new Map<string, { at: number; value: R2Manifest | null }>();

export function resetR2ManifestCacheForTest(): void {
  manifestMemo.clear();
}

function originOf(reqUrl?: string): string {
  if (!reqUrl) return "";
  try {
    return new URL(reqUrl).origin;
  } catch {
    return "";
  }
}

async function fetchArtifactText(env: Env, relPath: string, reqUrl?: string): Promise<string | null> {
  const cleanRel = relPath.replace(/^\/+/, "");

  // Tier 1: Dedicated R2 bucket public URL / CDN
  if (env.R2_ASSETS_BASE_URL) {
    const base = env.R2_ASSETS_BASE_URL.replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/${cleanRel}`);
      if (res.ok) return await res.text();
    } catch {
      // Fall through to Tier 2
    }
  }

  // Tier 2: Cloudflare Pages bundled static ASSETS (`/_r2/...`)
  if (env.ASSETS && reqUrl) {
    const origin = originOf(reqUrl);
    if (origin) {
      try {
        const res = await env.ASSETS.fetch(new Request(`${origin}/_r2/${cleanRel}`, { method: "GET" }));
        if (res.ok) return await res.text();
      } catch {
        // Fall through to Tier 3 (GitHub)
      }
    }
  }

  return null;
}

export async function loadR2Manifest(env: Env, reqUrl?: string): Promise<R2Manifest | null> {
  if (!env.R2_ASSETS_BASE_URL && !env.ASSETS) return null;
  const key = `${env.R2_ASSETS_BASE_URL || ""}::${originOf(reqUrl)}`;
  const hit = manifestMemo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const text = await fetchArtifactText(env, "v1/manifest.json", reqUrl);
  let value: R2Manifest | null = null;
  if (text) {
    try {
      const parsed = JSON.parse(text) as R2Manifest;
      if (parsed && typeof parsed.version === "number" && parsed.problems && parsed.practice && parsed.topics) {
        value = parsed;
      }
    } catch {
      value = null;
    }
  }
  // Cache successful manifest loads for TTL; avoid pinning transient misses if bindings exist.
  if (value !== null) {
    manifestMemo.set(key, { at: Date.now(), value });
  }
  return value;
}

export async function readR2Problem(env: Env, pad4: string, reqUrl?: string): Promise<string | null> {
  const manifest = await loadR2Manifest(env, reqUrl);
  const ref = manifest?.problems?.[pad4];
  if (!ref) return null;
  return fetchArtifactText(env, ref.path, reqUrl);
}

export async function readR2Practice(env: Env, pad4: string, reqUrl?: string): Promise<string | null> {
  const manifest = await loadR2Manifest(env, reqUrl);
  const ref = manifest?.practice?.[pad4];
  if (!ref) return null;
  return fetchArtifactText(env, ref.path, reqUrl);
}

export async function readR2TopicsIndex(env: Env, reqUrl?: string): Promise<string | null> {
  const manifest = await loadR2Manifest(env, reqUrl);
  const ref = manifest?.topicsIndex;
  if (!ref) return null;
  return fetchArtifactText(env, ref.path, reqUrl);
}

export async function readR2Topic(env: Env, slug: string, reqUrl?: string): Promise<string | null> {
  const manifest = await loadR2Manifest(env, reqUrl);
  const ref = manifest?.topics?.[slug];
  if (!ref) return null;
  return fetchArtifactText(env, ref.path, reqUrl);
}
