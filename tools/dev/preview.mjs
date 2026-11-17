// Starts the local resource adapter and Pages preview as one owned lifecycle.
import { spawn, execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startResourceApi } from "./resource-api.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url)), site = path.join(root, "site");
await access(path.join(site, "out/index.html")).catch(() => { throw Error("Static output is missing. Run npm run build in site/ first."); });
const server = await startResourceApi();
console.log("Reading problem resources from this checkout at http://127.0.0.1:8790");
const child = spawn(process.execPath, [path.join(site, "node_modules/wrangler/wrangler-dist/cli.js"), "pages", "dev", "out", "--ip", "127.0.0.1", "--port", "8788", "--binding", "GITHUB_API=http://127.0.0.1:8790", "--show-interactive-dev-session", "false"], { cwd: site, windowsHide: true, stdio: "inherit" });
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  if (child.exitCode === null && child.signalCode === null && child.pid) {
    if (process.platform === "win32") await new Promise((resolve) => execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => resolve()));
    else child.kill("SIGTERM");
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  process.exitCode = code;
}
child.once("error", (error) => { console.error(error.message); void shutdown(1); });
child.once("exit", (code) => { void shutdown(code ?? 1); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { void shutdown(0); });
