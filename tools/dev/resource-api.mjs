// Read-only GitHub resource API adapter for local Pages preview.
import http from "node:http";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPOSITORY = "Hanwen-Jiang/leetcode";
const RESOURCE_PREFIXES = ["studyplan/", "problems/", "illustrations/", "tools/illustrations/data/"];
const RESOURCE_EXTENSIONS = new Set([".md", ".html", ".json", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".bmp", ".ico"]);
const MIME = { ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".avif": "image/avif" };

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
function safeResource(relative) {
  const parts = relative.split("/");
  return !relative.includes("\\") && !relative.includes("\0") && parts.every((part) => part && !part.startsWith(".")) && RESOURCE_PREFIXES.some((prefix) => relative.startsWith(prefix)) && RESOURCE_EXTENSIONS.has(path.extname(relative).toLowerCase());
}
function send(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

export async function createResourceApi({ root = PROJECT_ROOT, repository = REPOSITORY } = {}) {
  const canonicalRoot = await fs.realpath(root), prefix = `/repos/${repository}/`;
  async function canonicalResource(relative) {
    if (!safeResource(relative)) return null;
    const candidate = path.resolve(canonicalRoot, relative);
    if (!inside(canonicalRoot, candidate)) return null;
    const canonical = await fs.realpath(candidate);
    const canonicalRelative = path.relative(canonicalRoot, canonical).split(path.sep).join("/");
    if (!inside(canonicalRoot, canonical) || !safeResource(canonicalRelative)) return null;
    const stat = await fs.stat(canonical);
    return stat.isFile() && stat.size <= 32 * 1024 * 1024 ? canonical : null;
  }
  async function tree() {
    const files = [];
    async function walk(relative) {
      const directory = path.resolve(canonicalRoot, relative), canonical = await fs.realpath(directory);
      if (!inside(canonicalRoot, canonical)) return;
      for (const entry of await fs.readdir(canonical, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
        const child = `${relative}/${entry.name}`;
        if (entry.isDirectory()) await walk(child);
        else if (entry.isFile() && safeResource(child) && await canonicalResource(child)) files.push({ path: child, type: "blob" });
      }
    }
    for (const allowed of RESOURCE_PREFIXES) {
      const relative = allowed.slice(0, -1);
      const stat = await fs.lstat(path.resolve(canonicalRoot, relative)).catch(() => null);
      if (stat?.isDirectory() && !stat.isSymbolicLink()) await walk(relative);
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }
  return http.createServer(async (request, response) => {
    if (request.method !== "GET") { response.setHeader("Allow", "GET"); send(response, 405, { error: "Only GET is supported" }); return; }
    try {
      const rawPath = (request.url || "/").split("?", 1)[0];
      if (rawPath === "/health") { send(response, 200, { service: "local-resource-api", repository, readOnly: true }); return; }
      if (!rawPath.startsWith(prefix)) { send(response, 404, { error: "Resource not found" }); return; }
      const route = rawPath.slice(prefix.length);
      if (/^git\/trees\/[^/]+$/.test(route)) { send(response, 200, { tree: await tree(), truncated: false }); return; }
      if (!route.startsWith("contents/")) { send(response, 404, { error: "Resource not found" }); return; }
      const relative = decodeURIComponent(route.slice("contents/".length));
      const filename = await canonicalResource(relative);
      if (!filename) { send(response, 404, { error: "Resource not found" }); return; }
      const data = await fs.readFile(filename);
      response.writeHead(200, { "Content-Type": MIME[path.extname(filename).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(data);
    } catch (error) {
      send(response, error instanceof URIError ? 400 : ["ENOENT", "ENOTDIR", "EACCES"].includes(error?.code) ? 404 : 500, { error: "Resource unavailable" });
    }
  });
}

export async function startResourceApi({ port = 8790, ...options } = {}) {
  const server = await createResourceApi(options);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); }); });
  return server;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  startResourceApi().then((server) => {
    console.log("Read-only local resource API: http://127.0.0.1:8790");
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { server.closeAllConnections(); server.close(); });
  }).catch((error) => { console.error(`Unable to start local resources: ${error.message}`); process.exitCode = 1; });
}
