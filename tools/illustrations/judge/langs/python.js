// Python：前置代码用 pytest_prelude.py（和 spec 里的 pytest 同一套），后面接题解和 runner.py
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { run, pool, hasTool, parseLines, flatSig, cores } = require("../util");

const prelude = fs.readFileSync(path.join(__dirname, "../../pytest_prelude.py"), "utf8");
const runner = fs.readFileSync(path.join(__dirname, "../prelude/runner.py"), "utf8");
const cmd = () => (process.env.PYTHON || (process.platform === "win32" ? "python" : "python3")).split(" ");

function write(job, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const py = path.join(dir, `${job.name}.py`), json = path.join(dir, `${job.name}.json`);
  fs.writeFileSync(py, prelude + "\n" + job.code + "\n" + runner);
  fs.writeFileSync(json, JSON.stringify({ sig: flatSig(job.sig), cases: job.cases }));
  return [py, json];
}

module.exports = {
  id: "python",
  available: () => hasTool(cmd()[0], [...cmd().slice(1), "--version"]),
  /** build.js 用：同步跑一段代码，返回每个用例的输出 */
  runSync(job, dir) {
    const [py, json] = write(job, dir);
    const c = cmd();
    const r = cp.spawnSync(c[0], [...c.slice(1), py, json], { encoding: "utf8", timeout: 60000, windowsHide: true });
    return parseLines(r.stdout || "", job.cases.length, (r.stderr || "").trim().split("\n").pop());
  },
  async runAll(jobs, dir) {
    const c = cmd();
    return pool(jobs, cores, async (job) => {
      const [py, json] = write(job, dir);
      const r = await run(c[0], [...c.slice(1), py, json]);
      return { outputs: parseLines(r.stdout, job.cases.length, r.timedOut ? "超时" : r.stderr.trim().split("\n").pop()) };
    });
  },
};
