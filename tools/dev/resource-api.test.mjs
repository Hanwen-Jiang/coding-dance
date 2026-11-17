import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createResourceApi } from "./resource-api.mjs";

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "leetcode-resource-api-test-")), root = path.join(temporary, "checkout"), outside = path.join(temporary, "outside");
await fs.mkdir(path.join(root, "studyplan"), { recursive: true });
await fs.mkdir(path.join(root, "problems"), { recursive: true });
await fs.mkdir(path.join(root, ".git"), { recursive: true });
await fs.mkdir(outside, { recursive: true });
await fs.writeFile(path.join(root, "studyplan", "热题100.md"), "resource fixture", "utf8");
await fs.writeFile(path.join(root, "problems", ".env"), "private fixture", "utf8");
await fs.writeFile(path.join(root, ".git", "secret.md"), "private fixture", "utf8");
await fs.writeFile(path.join(outside, "secret.md"), "outside fixture", "utf8");
await fs.symlink(outside, path.join(root, "problems", "outside-link"), process.platform === "win32" ? "junction" : "dir");
await fs.symlink(path.join(root, ".git"), path.join(root, "problems", "private-link"), process.platform === "win32" ? "junction" : "dir");
const server = await createResourceApi({ root });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port, prefix = "/repos/Hanwen-Jiang/leetcode/";
function request(route, method = "GET") {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: "127.0.0.1", port, method, path: route }, (response) => {
      let body = ""; response.setEncoding("utf8"); response.on("data", (chunk) => body += chunk); response.on("end", () => resolve({ status: response.statusCode, body }));
    });
    r.on("error", reject); r.end();
  });
}
try {
  const document = await request(prefix + "contents/studyplan/" + encodeURIComponent("热题100.md"));
  assert.equal(document.status, 200); assert.equal(document.body, "resource fixture");
  const tree = await request(prefix + "git/trees/main?recursive=1");
  assert.equal(tree.status, 200); assert.deepEqual(JSON.parse(tree.body).tree, [{ path: "studyplan/热题100.md", type: "blob" }]);
  for (const route of ["contents/proble../studyplan/x.md", "contents/proble%5Cms/x.md", "contents/problems/../.git/secret.md", "contents/problems/%2e%2e/.git/secret.md", "contents/problems/.env", "contents/problems/outside-link/secret.md", "contents/problems/private-link/secret.md", "contents/%2fproblems/secret.md", "contents/problems/secret%00.md", "../hot100-progress/contents/progress.json"]) {
    assert.equal((await request(prefix + route)).status, 404, `should reject ${route}`);
  }
  assert.equal((await request(prefix + "contents/problems/%ZZ.md")).status, 400);
  assert.equal((await request(prefix + "git/trees/main", "POST")).status, 405);
  assert.equal((await request("/repos/other/private/contents/secret.md")).status, 404);
  console.log("Local resource API verified: Unicode/raw reads, safe tree, GET-only, repository allowlist, traversal/hidden-file rejection and both external/internal symlink escapes.");
} finally {
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  // Remove only test-owned links first, then its verified, unique fixture directory.
  await fs.unlink(path.join(root, "problems", "outside-link"));
  await fs.unlink(path.join(root, "problems", "private-link"));
  const canonical = await fs.realpath(temporary), tempRoot = await fs.realpath(os.tmpdir());
  assert.equal(path.dirname(canonical).toLowerCase(), tempRoot.toLowerCase());
  assert.ok(path.basename(canonical).startsWith("leetcode-resource-api-test-"));
  await fs.rm(canonical, { recursive: true, force: true });
}
