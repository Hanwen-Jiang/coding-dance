# 远端运行器（云端运行 / 判题 / 调试）

Java、C++、Go 的练习交给这里运行和调试（Python、JavaScript、TypeScript 在浏览器里跑）。ROADMAP 阶段 6。

```
浏览器 ──POST /api/run──▶ 网站（Pages Functions，认登录、签名）──HTTPS──▶ Cloudflare Tunnel ──▶ win-gw-lou 上的 Linux 虚拟机
                                                                                   server.mjs（验签、限流、排队）
                                                                                     └─ docker exec 一个全新的容器 → sandbox.js
```

- **每次运行一个新容器**，用完就删：不能上网、根文件系统只读、普通用户、去掉所有特权、限内存 1 GB / CPU 1 核 / 进程 256 个 / 单个文件 128 MB。容器池里预先起好几个空容器，所以不用等容器启动。容器外面还隔着一层虚拟机。
- **判题和 CI 用同一份代码**：力扣模式的参数和输出由判题器（`tools/illustrations/judge/`）生成，和 CI 判官方题解的完全一样。每组前后写分隔标记，一组崩溃或超时就从下一组重新启动程序，其他组不受影响。
- **调试用真调试器**：C++ 用 gdb、Java 用 JDI、Go 用 Delve，一步一步走用户的代码，记下行号、调用栈、变量、返回值和异常。记录的格式和浏览器里的执行记录一样（`site/lib/practice/types.ts` 的 `PracticeTrace`），练习区的调试面板直接用。
- **不存东西**：代码和结果只在内存和一次性容器里，日志只记用户名、语言、模式、用了多久。

## 目录

| 文件 | 作用 |
| --- | --- |
| `server.mjs` | HTTP 服务：`GET /healthz`、`GET /v1/status`、`POST /v1/run` |
| `lib/sign.mjs` | 请求签名（网站那边是 `site/functions/_lib/runner.ts`，算法要一致） |
| `lib/sandbox.mjs` | 容器池（docker）和本机开发用的 local 驱动 |
| `sandbox/sandbox.js` | 容器里的入口：读任务、编译、逐组运行或调试、输出结果 |
| `sandbox/programs.js` | 把用户代码拼成程序（力扣模式加判题入口，ACM 模式原样） |
| `sandbox/toolchain.js` | 各语言怎么编译运行、报错怎么换成编辑器里的行号、崩溃怎么说 |
| `sandbox/exec.js` | 跑子进程、分隔标记、一组崩溃从下一组接着跑 |
| `sandbox/trace/` | 调试器：`gdb_trace.py`、`JdiTrace.java`、`dlv.js` |
| `sandbox/prepare.js` | 构建镜像时预先做好：C++ 预编译头、Go 标准库归档、Java 调试器 |
| `image/Dockerfile` | 沙箱镜像（Ubuntu 24.04、Python 3.12、OpenJDK 21、g++ 13 + gdb、Go 1.23 + Delve、Node 24） |
| `deploy/` | 虚拟机里一键安装（`setup.sh`）和 systemd 服务 |
| `test/` | `sandbox.test.mjs`（六种语言、调试、容器限制）、`server.test.mjs`（签名、限流、经服务跑一次） |

## 接口

请求都要签名（`GET /healthz` 除外）：

```
X-Runner-Time: <Unix 秒>
X-Runner-Nonce: <16–64 位随机串>
X-Runner-User: <GitHub 用户名>
X-Runner-Signature: hex(HMAC-SHA256(RUNNER_SECRET, 方法 \n 路径 \n 时间 \n 随机串 \n 用户 \n hex(SHA-256(请求体))))
```

时间差超过 120 秒、随机串用过的都拒绝。

`POST /v1/run`

```jsonc
// 请求
{ "lang": "java", "mode": "leetcode",            // 或 "acm"
  "code": "class Solution { … }",
  "sig": { "fn": "twoSum", "params": ["int[]", "int"], "ret": "int[]" },   // 力扣模式：练习数据里的签名
  "cases": [{ "input": [[2, 7, 11, 15], 9] }],   // ACM 模式：[{ "stdin": "…" }]
  "debug": false }                                // true：只能一组，Java / C++ / Go
// 响应
{ "ok": true, "compileMs": 812, "runMs": 230, "queueMs": 0, "totalMs": 1104,
  "compileError": "第 3 行第 18 列: error: …",    // 编译不过时才有，每组的 error 也会写上
  "results": [{ "index": 0, "actual": [0, 1], "stdout": "", "error": null, "duration": 12, "trace": { "steps": […] } }] }
```

对答案在浏览器里做（和浏览器里运行同一套比较）。状态码：400 参数不对、401 签名不对、429 这个用户太频繁（每分钟 `RUNNER_USER_PER_MIN` 次，同时一个）、503 排队满了。

## 在 win-gw-lou 上部署

win-gw-lou 是 Windows，用它当虚拟机的宿主：开一台 Ubuntu 24.04 虚拟机跑运行器，cloudflared 继续跑在 Windows 上。

1. **开虚拟机**（二选一）
   - Hyper-V：新建 Ubuntu 24.04 虚拟机（2 核以上、4 GB 内存以上、40 GB 磁盘），网络接「Default Switch」。
   - WSL2：`wsl --install -d Ubuntu-24.04`，在 `/etc/wsl.conf` 里加 `[boot]` `systemd=true`，`wsl --shutdown` 后重开。
2. **把仓库放进虚拟机**（`git clone` 或者复制一份），在仓库根目录：
   ```bash
   sudo bash tools/runner/deploy/setup.sh                       # WSL2（服务只听 127.0.0.1:8790）
   RUNNER_LISTEN=0.0.0.0 sudo -E bash tools/runner/deploy/setup.sh   # Hyper-V（让宿主经虚拟机 IP 访问）
   ```
   它会装 Docker 和 Node、构建镜像、生成密钥写进 `/etc/lc-runner.env`、装成 `lc-runner` 服务。以后更新代码再跑一次就行。
3. **接上 Tunnel**：Cloudflare 控制台 → Zero Trust → Networks → Tunnels → win-gw-lou → Public Hostname → 添加
   `run.cgent.link` → `http://localhost:8790`（WSL2）或 `http://<虚拟机 IP>:8790`（Hyper-V）。
   不要动已有的 `test-code.cgent.link`。Hyper-V 的话在虚拟机里用 `ufw allow from <宿主 IP> to any port 8790` 只放宿主进来。
4. **网站**：`site/wrangler.toml` 的 `RUNNER_URL` 设成 `https://run.cgent.link`；Pages 的加密环境变量 `RUNNER_SECRET` 设成虚拟机 `/etc/lc-runner.env` 里的那个值（`sudo grep RUNNER_SECRET /etc/lc-runner.env`），重新部署网站。
5. **验证**：`curl https://run.cgent.link/healthz` 返回 `{"ok":true}`；网站的 `GET /api/run` 返回 `"available": true`；在题目页把语言换成 Java 跑一下。

可选：
- **再加一道门**：给 `run.cgent.link` 配一个 Cloudflare Access 应用，只放「服务令牌」；把令牌的 Client ID / Secret 设成 Pages 的加密环境变量 `RUNNER_ACCESS_ID` / `RUNNER_ACCESS_SECRET`。
- **更强的隔离**：容器运行时换成 gVisor（装 `runsc` 后 `runsc install`、重启 Docker，`/etc/lc-runner.env` 里 `RUNNER_RUNTIME=runsc`），或 Kata Containers（每个容器一台 KVM 小虚拟机，要虚拟机开嵌套虚拟化，`RUNNER_RUNTIME=kata-runtime`）。换之前先跑一遍测试：调试器要 ptrace，gVisor 下 gdb / dlv 不一定都能用。
  ```bash
  RUNNER_TEST_IMAGE=lc-runner:latest RUNNER_TEST_RUNTIME=runsc node tools/runner/test/sandbox.test.mjs
  ```

### 配置（`/etc/lc-runner.env`）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `RUNNER_SECRET` | — | 必填，至少 32 个字符，和网站的一样 |
| `RUNNER_HOST` / `RUNNER_PORT` | `127.0.0.1` / `8790` | 监听地址 |
| `RUNNER_IMAGE` | `lc-runner:latest` | 沙箱镜像 |
| `RUNNER_RUNTIME` | （runc） | `runsc`、`kata-runtime` |
| `RUNNER_POOL` | 2 | 预先起好的空容器数 |
| `RUNNER_SLOTS` / `RUNNER_QUEUE` | 2 / 20 | 同时运行几个、最多排队几个 |
| `RUNNER_MEMORY` / `RUNNER_CPUS` / `RUNNER_PIDS` | `1g` / `1` / 256 | 每个容器的限制 |
| `RUNNER_USER_PER_MIN` | 20 | 每个用户每分钟最多几次 |
| `RUNNER_CASE_MS` / `RUNNER_TOTAL_MS` | 3000 / 30000 | 每组、每次的时间上限 |

## 本机开发和测试

```bash
node tools/runner/test/sandbox.test.mjs          # 不隔离，只测本机装了工具链的语言
node tools/runner/test/server.test.mjs
RUNNER_DRIVER=local RUNNER_ALLOW_LOCAL=1 RUNNER_SECRET=$(openssl rand -hex 32) node tools/runner/server.mjs
```

有 Docker 时测镜像（CI 就是这么跑的）：

```bash
docker build -f tools/runner/image/Dockerfile -t lc-runner:dev .
RUNNER_TEST_IMAGE=lc-runner:dev node tools/runner/test/sandbox.test.mjs
RUNNER_TEST_IMAGE=lc-runner:dev node tools/runner/test/server.test.mjs
```

## 还没做

- 每天的额度、订阅档位：要在服务端记用量，等 ROADMAP「待决定 1」。现在只按用户名限流。
- 交互式调试（断点停住、在调试器里求值）：现在是一次跑完、记下每一步，界面上前进后退；以后可以用 DAP 接 WebSocket。
- Python / JavaScript / TypeScript 走云端（递归太深、要精确计时时兜底）：运行器已经支持，网站上还没有入口。
- 判题用例里超大的输入（卡复杂度的 n = 10⁵）：Java 的用例写成字面量，单个方法超过 64 KB 会编译不过，要改成从文件读。
