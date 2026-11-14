// 同步页面：连接 GitHub（设备授权）→ 确认力扣已登录 → 检查要同步的内容 → 用户确认后写入。
import { createGitHub, pollDevice, refreshToken, startDevice } from "./github.js";
import { createLeetCode, inPageGraphQL, unwrap } from "./leetcode.js";
import { buildPlan, commitPlan, finalize } from "./sync.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const store = {
  get: async (k) => (await chrome.storage.local.get(k))[k],
  set: (k, v) => chrome.storage.local.set({ [k]: v }),
  del: (k) => chrome.storage.local.remove(k),
};
const setDot = (id, cls) => { $(id).className = "dot" + (cls ? " " + cls : ""); };
const log = (msg, bad) => { $("log").textContent = msg || ""; $("log").classList.toggle("err", !!bad); };

// ---------- GitHub ----------
let refreshing = null;
async function getToken() {
  const t = await store.get("gh");
  if (!t) throw new Error("还没连接 GitHub");
  if (!t.accessExp || t.accessExp - Date.now() > 5 * 60 * 1000) return t.access;
  // 令牌快过期了：换新的（同时只换一次，refresh token 用过一次就作废）
  refreshing ||= refreshToken(fetch, t).then(async (nt) => { await store.set("gh", nt); return nt.access; }).finally(() => { refreshing = null; });
  return refreshing;
}
const gh = createGitHub({ fetch: (...a) => fetch(...a), getToken });
let ghUser = null, deviceAbort = null;

async function showGitHub() {
  const t = await store.get("gh");
  $("gh-device").hidden = true;
  if (!t) {
    setDot("gh-dot"); $("gh-state").textContent = "还没连接";
    $("gh-connect").hidden = false; $("gh-repo-wrap").hidden = true; $("gh-logout").hidden = true;
    ghUser = null; return refreshPlanButton();
  }
  $("gh-connect").hidden = true; $("gh-repo-wrap").hidden = false; $("gh-logout").hidden = false;
  try {
    ghUser = (await gh.user()).login;
    const repo = (await store.get("repo")) || `${ghUser}/hot100-progress`;
    $("gh-repo").value = repo;
    $("gh-state").textContent = `已连接 ${ghUser}，检查仓库…`;
    await gh.head(repo);
    setDot("gh-dot", "ok"); $("gh-state").textContent = `已连接 ${ghUser} · 可以写入 ${repo}`;
  } catch (e) {
    setDot("gh-dot", "bad"); $("gh-state").textContent = e.message;
  }
  refreshPlanButton();
}

$("gh-connect").onclick = async () => {
  try {
    const dev = await startDevice(fetch);
    $("gh-code").textContent = dev.user_code;
    $("gh-device").hidden = false; $("gh-connect").hidden = true;
    $("gh-state").textContent = "等你在 GitHub 上确认…";
    $("gh-open").onclick = () => chrome.tabs.create({ url: dev.verification_uri });
    $("gh-copy").onclick = () => navigator.clipboard.writeText(dev.user_code);
    deviceAbort = new AbortController();
    const tok = await pollDevice(fetch, dev, { signal: deviceAbort.signal });
    await store.set("gh", tok);
  } catch (e) {
    $("gh-state").textContent = e.message; setDot("gh-dot", "bad");
  }
  showGitHub();
};
$("gh-cancel").onclick = () => { deviceAbort?.abort(); $("gh-device").hidden = true; $("gh-connect").hidden = false; };
$("gh-logout").onclick = async () => { await store.del("gh"); await store.del("repo"); showGitHub(); };
$("gh-repo").onchange = async () => { await store.set("repo", $("gh-repo").value.trim()); showGitHub(); };

// ---------- 力扣：在已登录的 leetcode.cn 标签页里发请求 ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function lcTab({ open = false } = {}) {
  let [tab] = await chrome.tabs.query({ url: "https://leetcode.cn/*" });
  if (!tab) {
    if (!open) return null;
    tab = await chrome.tabs.create({ url: "https://leetcode.cn/problemset/", active: false });
  }
  for (let k = 0; k < 60 && (await chrome.tabs.get(tab.id)).status !== "complete"; k++) await sleep(500);
  return tab.id;
}
async function transport(query, variables) {
  for (let k = 0; k < 2; k++) {
    const tabId = await lcTab({ open: true });
    try {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: inPageGraphQL, args: [query, variables] });
      return unwrap(result);
    } catch (e) {
      if (k || !/No tab|closed|Frame|Cannot access/i.test(e.message)) throw e; // 标签页被关掉了：换一个再来
    }
  }
}
let lcUser = null;
async function showLeetCode({ open = false } = {}) {
  setDot("lc-dot"); $("lc-state").textContent = "检查中…";
  try {
    if (!(await lcTab({ open }))) { lcUser = null; $("lc-state").textContent = "没有打开的 leetcode.cn 标签页。点「打开 leetcode.cn」，登录后再检查。"; return refreshPlanButton(); }
    const st = (await transport(`query { userStatus { isSignedIn username } }`, {})).userStatus;
    lcUser = st.isSignedIn ? st.username : null;
    setDot("lc-dot", lcUser ? "ok" : "warn");
    $("lc-state").textContent = lcUser ? `已登录 ${lcUser}` : "leetcode.cn 还没登录：在那个标签页里登录后点「重新检查」。";
  } catch (e) {
    lcUser = null; setDot("lc-dot", "bad"); $("lc-state").textContent = e.message;
  }
  refreshPlanButton();
}
$("lc-check").onclick = () => showLeetCode();
$("lc-open").onclick = async () => { await chrome.tabs.create({ url: "https://leetcode.cn/" }); };

// ---------- 同步 ----------
const lc = createLeetCode(transport, { onWait: (s) => log(`力扣说请求太频繁了，等 ${s} 秒再继续…`) });
const shaCache = new Map(); // 只是这次打开页面期间的仓库内容缓存，关掉页面就没了
let plan = null, base = null;
const excluded = new Set(); // 用户取消勾选的力扣提交编号
const refreshPlanButton = () => { $("plan").disabled = !(ghUser && lcUser); };

function showPlan(p) {
  plan = p;
  $("result").hidden = false; $("done").hidden = true;
  const n = p.added.length, l = p.linked.length, s = p.changes.size, d = p.dropped.length;
  const partial = p.partial ? `<p class="err">力扣一直提示请求太频繁，只读完了 ${p.partial.done} / ${p.partial.total} 道题（停在第 ${p.partial.next.id} 题）。可以先写入下面这些，过一会儿再同步，会接着读剩下的。</p>` : "";
  $("summary").innerHTML = partial + (p.writes.length
    ? `要写入：新增 <b>${n}</b> 条尝试记录` + (l ? `，给 <b>${l}</b> 条手写记录补上力扣提交编号` : "") + (s ? `，<b>${s}</b> 道题的状态会变` : "") + (d ? `，<b>${d}</b> 次提交记进不导入名单（attempts/skip.txt）` : "") + "。取消勾选的提交不会导入，以后也不再列出来。"
    : "仓库已经是最新的，没有要写入的内容。");
  $("table").tBodies[0].innerHTML = p.perProblem.map((x) => {
    const named = new Map(x.files.map((f) => [f.id, f.path.split("/").pop()]));
    const rows = x.candidates.map((c) => `<label class="pick"><input type="checkbox" data-id="${esc(c.id)}" ${excluded.has(c.id) ? "" : "checked"}> ${esc(named.get(c.id) || `不导入：${c.date} ${c.result}`)}</label>`);
    return `<tr>
    <td>${x.problem.id}. ${esc(x.problem.name)}</td>
    <td>${x.files.length || ""}${rows.length ? `<div class="files">${rows.join("")}</div>` : ""}</td>
    <td>${x.linked.length || ""}${x.linked.length ? `<div class="files">${x.linked.map((f) => esc(f.path.split("/").pop())).join("<br>")}</div>` : ""}</td>
    <td>${x.status ? `${esc(x.before)} → <b>${esc(x.status.status)}</b>` : ""}</td></tr>`;
  }).join("");
  for (const box of $("table").querySelectorAll("input[type=checkbox]")) {
    box.onchange = () => { box.checked ? excluded.delete(box.dataset.id) : excluded.add(box.dataset.id); showPlan(finalize(base, excluded)); };
  }
  $("table").hidden = !p.perProblem.length;
  $("skipped-wrap").hidden = !p.skipped.length;
  $("skipped-title").textContent = `跳过 ${p.skipped.length} 次提交`;
  $("skipped").innerHTML = p.skipped.map((x) => `<li>${x.problem.id}. ${esc(x.problem.name)} · 提交 ${esc(x.sub.id)}：${esc(x.reason)}</li>`).join("");
  $("confirm").hidden = !p.writes.length;
  $("confirm-repo").textContent = p.repo;
}

$("plan").onclick = async () => {
  $("plan").disabled = true; $("result").hidden = true; $("done").hidden = true;
  try {
    const repo = $("gh-repo").value.trim();
    excluded.clear();
    base = await buildPlan({ gh, lc, repo, shaCache, onProgress: (m) => log(m) });
    showPlan(finalize(base, excluded));
    log("");
  } catch (e) { log(e.message, true); }
  refreshPlanButton();
};
$("discard").onclick = () => { plan = null; $("result").hidden = true; log("没有写入任何东西。"); };
$("commit").onclick = async () => {
  if (!plan) return;
  $("commit").disabled = $("discard").disabled = true;
  try {
    const res = await commitPlan({ gh, lc, plan, shaCache, onProgress: (m) => log(m) });
    if (res.changed) { base = res.plan; showPlan(finalize(base, excluded)); log("仓库在这期间变了，要写入的内容也跟着变了。请重新确认。", true); return; }
    $("result").hidden = true; $("done").hidden = false; log("");
    $("done").innerHTML = res.nothing ? "仓库已经是最新的。" : `写入完成：<a href="${esc(res.url)}" target="_blank" rel="noopener">查看这次 commit</a>。网站上的「尝试记录」一分钟内会更新。`;
    plan = null;
  } catch (e) { log(e.message, true); }
  finally { $("commit").disabled = $("discard").disabled = false; }
};

showGitHub();
showLeetCode();
