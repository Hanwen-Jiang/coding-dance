# 远端运行器（云端运行 / 判题 / 调试）

Java、C++、Go 的练习交给这里运行和调试，C、C#、Kotlin、Swift、Rust、Ruby、PHP、Scala、Dart 交给这里运行。Python、JavaScript、TypeScript 默认在浏览器里跑，用户在练习区选了「云端」时运行和测试也交给这里（调试仍在浏览器里）。ROADMAP 阶段 6。

```
浏览器 ──POST /api/run──▶ 网站（Pages Functions：认登录、挑节点、签名）
                              │  按用户固定到一个节点，满了 / 下线了换下一个
                              ├──HTTPS──▶ run-lou1.codingdance.cn ─Tunnel─▶ 节点 lou1（win-gw-lou 上的虚拟机）
                              ├──HTTPS──▶ run-lou2.codingdance.cn ─Tunnel─▶ 节点 lou2（以后加的虚拟机 / KVM 主机）
                              └── …
每个节点：server.mjs（验签、限流、排队）── fc-manager 交出一台全新的 Firecracker microVM ── 客户机 agent 执行 sandbox.js
```

运行器是一个**集群**：每台虚拟机或 KVM 主机跑一份运行器，就是一个节点，有自己的编号和地址（经 Cloudflare Tunnel）。节点之间不共享任何状态，每次运行都是独立的，所以加节点就是加容量。怎么挑节点见下面「集群」。

- **每次运行一台新的 Firecracker microVM**，用完就销毁：自己的内核（用户代码碰不到宿主的内核），**没有网卡**（只有和宿主之间的 vsock），根文件系统只读，命令以普通用户跑，内存 1 GiB、1 核。VM 由 [agent-runtime](https://github.com/Hanwen-Jiang/agent-runtime) 的 fc-manager 管：jailer 给每台 VM 单独的 uid、chroot、PID 和网络命名空间、cgroup v2 上限，firecracker 自己装 seccomp；预热池常备几台空 VM，交出一台只要几毫秒（agent-runtime 实测冷启动 1.2 秒）。见下面「Firecracker」。
- **判题和 CI 用同一份代码**：力扣模式的参数和输出由判题器（`tools/illustrations/judge/`）生成，和 CI 判官方题解的完全一样。每组前后写分隔标记，一组崩溃或超时就从下一组重新启动程序，其他组不受影响。
- **调试用真调试器**：C++ 用 gdb、Java 用 JDI、Go 用 Delve，一步一步走用户的代码，记下行号、调用栈、变量、返回值和异常。记录的格式和浏览器里的执行记录一样（`site/lib/practice/types.ts` 的 `PracticeTrace`），练习区的调试面板直接用。
- **不存东西**：代码和结果只在内存和一次性容器里，日志只记用户名、语言、模式、用了多久。

## 目录

| 文件 | 作用 |
| --- | --- |
| `server.mjs` | HTTP 服务：`GET /healthz`、`GET /v1/status`、`POST /v1/run` |
| `lib/sign.mjs` | 请求签名（网站那边是 `site/functions/_lib/runner.ts`，算法要一致） |
| `lib/sandbox.mjs` | 驱动：firecracker（生产，经 fc-manager）、docker（开发和 CI）、local（本机，不隔离） |
| `sandbox/sandbox.js` | 容器里的入口：读任务、编译、逐组运行或调试、输出结果 |
| `sandbox/programs.js` | 把用户代码拼成程序（力扣模式加判题入口，ACM 模式原样） |
| `sandbox/toolchain.js` | 各语言怎么编译运行、报错怎么换成编辑器里的行号、崩溃怎么说 |
| `sandbox/exec.js` | 跑子进程、分隔标记、一组崩溃从下一组接着跑 |
| `sandbox/trace/` | 调试器：`gdb_trace.py`、`JdiTrace.java`、`dlv.js` |
| `sandbox/prepare.js` | 构建镜像时预先做好：C++ 预编译头、Go 标准库归档、Java 调试器、C# 的引用程序集列表、Kotlin / Scala 编译器的 CDS 归档，再把每种新语言编一个例子跑一下 |
| `image/Dockerfile` | 沙箱镜像（Ubuntu 24.04、Python 3.12、OpenJDK 21、gcc / g++ 13 + gdb + uthash、Go 1.23 + Delve、Node 24、.NET 8、Kotlin 2.1、Scala 2.13、Swift 6.1、Rust 1.86、Ruby 3.2、PHP 8.3、Dart 3.7）；部署时转成 microVM 的根文件系统 |
| `deploy/` | 一键安装节点（`setup.sh`）、Firecracker 这一层（`firecracker.sh`）、两个 systemd 服务 |
| `test/` | `sandbox.test.mjs`（十五种语言、调试、隔离检查；本机 / 容器 / microVM 都能跑；没有官方题解的九种用 `languages.mjs` 里手写的题解）、`starters.test.mjs`（Python、JavaScript、TypeScript 和九种云端语言 × 100 题的起始代码和判题程序对得上）、`server.test.mjs`（签名、限流）、`firecracker.test.mjs`（驱动的协议，对着假 fc-manager） |

### 后加的九种语言

起始代码是力扣原样的（`tools/practice/leetcode-starters.json`，`tools/practice/fetch-starters.mjs` 从 leetcode.cn 取；力扣没有的：Dart 的 138、141、142、160、236、240 照力扣 Dart 的写法补，Rust 的 138、141、142、160 力扣模式做不了，只能用 ACM 模式）。判题程序（`tools/illustrations/judge/langs/<语言>.js` 和 `prelude/`）按同样的类型、同样的函数名调用：

| 语言 | 参数怎么给 | 结果怎么写成 JSON | 编译 / 运行 |
| --- | --- | --- | --- |
| C | 按签名生成：数组带长度（`nums, numsSize`），返回数组用 `returnSize`、`returnColumnSizes` | 按签名生成 | gcc，和 C++ 一样开 AddressSanitizer、UBSan |
| C# | 字面量（`int[]`、`IList<T>`） | 运行时按类型 | Roslyn（`csc.dll`）直接编，`dotnet prog.dll` 跑；用例在 256 MB 栈的线程里跑 |
| Kotlin / Scala | 字面量（`IntArray`、`Array[Int]`、`List[String]`） | 运行时按类型 | 编译器跑在 JDK 21 上，只用 C1 + CDS 归档（冷启动从 5 秒降到 2 秒左右）；运行和 Java 一样 `-Xss64m` |
| Swift | 带类型的字面量，原地修改的数组是 `inout` | 按静态类型（协议 `JJ`） | `swiftc -Onone -g`：`-O` 下越界只会 ud2，不说原因、没有行号；崩溃时 `SWIFT_BACKTRACE` 打出带行号的调用栈 |
| Rust | 带类型的字面量，原地修改传 `&mut` | 按静态类型（trait `J`） | `rustc -O`；`catch_unwind` 接住每组的 panic，用例在 256 MB 栈的线程里跑 |
| Dart | 带类型的字面量 | 运行时按类型 | `dart compile kernel` + JIT（AOT 的调用栈没有行号） |
| Ruby / PHP | 和 Python 一样运行时读 JSON、按签名转换 | 运行时 | `ruby -c` / `php -l` 查语法；Ruby 用例在线程里跑（栈 128 MB） |

调试只有 Java、C++、Go（真调试器）；其余云端语言只能运行。网站按 `/v1/status` 报的 `langs` 判断哪些语言能在云端跑，节点还没更新到新镜像时，新语言在练习区显示成暂时不能用。

Python、JavaScript、TypeScript（练习区选了「云端」时）：Python 先 `py_compile` 查语法，JavaScript 先 `node --check`；TypeScript 和浏览器里一样只转成 JavaScript、不做类型检查，运行前用 Node 自带的转换器（`module.stripTypeScriptTypes`）解析一遍，语法错误报成编译错误、带编辑器里的行号；运行加 `--experimental-transform-types`，`enum`、构造函数参数属性（`constructor(public x: number)`）这些要转换的写法也能用（只擦类型的话 Node 会直接报错）。

## Firecracker：为什么、用了什么

Docker 容器和宿主共用一个内核：用户代码只要碰上一个内核漏洞就能逃出容器，拿到节点上的密钥、看到别人正在跑的代码。跑公开用户的代码要一层自己的内核，所以每次运行一台 Firecracker microVM（AWS Lambda 用的同一个虚拟机监视器）。

这一层**不自己写**，用 [agent-runtime](https://github.com/Hanwen-Jiang/agent-runtime) 现成的（固定在 `deploy/firecracker.sh` 里的 `AGENT_RUNTIME_REF` 这个提交）：

| 用到的 | agent-runtime 里的位置 | 做什么 |
| --- | --- | --- |
| fc-manager | `services/rs-fc-manager` | 宿主上的服务：建 / 销毁 microVM、jailer 隔离、cgroup 上限、预热池、经 vsock 转给客户机 agent |
| sandbox-agent | `services/rs-sandbox-agent` | 客户机里的 PID 1：挂好只读根和可写的 `/workspace`、`/tmp`，HTTP 接受执行命令 |
| 客户机内核 | `deploy/images/firecracker/build-kernel.sh` | 没有网卡驱动、没有模块、vsock、ext4 |
| 根文件系统 | `deploy/images/firecracker/rootfs.sh` | 把我们的 Docker 镜像转成只读 ext4，放进 agent |
| Firecracker、jailer | `deploy/cluster/versions.conf` | 版本和 sha256 |

我们这边只有一个驱动（`lib/sandbox.mjs` 的 `FirecrackerDriver`，几十行）：建 microVM → 让客户机 agent 执行 `node sandbox.js`（任务从标准输入进去）→ 销毁。沙箱程序和镜像不用改，Docker 和 microVM 里跑的是同一份。

客户机里能做的：编译运行、调试器（gdb、dlv、JDI 在客户机里照常 ptrace），读写 `/workspace` 和 `/tmp`。不能做的：联网（没有网卡）、写根文件系统、碰宿主。fork 炸弹、吃满内存只会拖垮它自己那台，下一次运行是新的一台。

## 接口

请求都要签名（`GET /healthz` 除外）：

```
X-Runner-Time: <Unix 秒>
X-Runner-Nonce: <16–64 位随机串>
X-Runner-User: <GitHub 用户名>
X-Runner-Node: <要找的节点编号>
X-Runner-Signature: hex(HMAC-SHA256(RUNNER_SECRET, 方法 \n 路径 \n 时间 \n 随机串 \n 用户 \n 节点编号 \n hex(SHA-256(请求体))))
```

时间差超过 120 秒、随机串用过的、节点编号不是自己的都拒绝（各节点共用一个密钥，签给 lou1 的请求在 lou2 上重放也不认）。

`GET /v1/status` 返回节点编号、容量（`slots`）、负载（`busy`、`queued`）、支持的语言和版本，网站按它挑节点。

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

1. **开虚拟机，打开嵌套虚拟化**（Firecracker 要 KVM，虚拟机里要能再开虚拟机；二选一）
   - Hyper-V：新建 Ubuntu 24.04 虚拟机（4 核以上、8 GB 内存以上、60 GB 磁盘），网络接「Default Switch」；关机状态下在 PowerShell（管理员）里
     `Set-VMProcessor -VMName <虚拟机名> -ExposeVirtualizationExtensions $true`，再开机。
   - WSL2：`wsl --install -d Ubuntu-24.04`；`%UserProfile%\.wslconfig` 里写 `[wsl2]` `nestedVirtualization=true`（Windows 11 默认就开）；在 `/etc/wsl.conf` 里加 `[boot]` `systemd=true`，`wsl --shutdown` 后重开。
   - 进虚拟机看一眼 `ls -l /dev/kvm` 有没有。
2. **把仓库放进虚拟机**（`git clone` 或者复制一份），在仓库根目录：
   ```bash
   RUNNER_NODE_ID=lou1 sudo -E bash tools/runner/deploy/setup.sh                        # WSL2（服务只听 127.0.0.1:8790）
   RUNNER_NODE_ID=lou1 RUNNER_LISTEN=0.0.0.0 sudo -E bash tools/runner/deploy/setup.sh  # Hyper-V（让宿主经虚拟机 IP 访问）
   ```
   它会：装 Node；跑 `firecracker.sh`（编 agent-runtime 的 fc-manager 和 sandbox-agent、装 Firecracker、编客户机内核、把镜像转成根文件系统、装 `fc-manager` 服务；第一次要二三十分钟，主要是编内核）；生成密钥写进 `/etc/lc-runner.env`；装 `lc-runner` 服务。以后更新代码再跑一次就行（内核和 Rust 没变就不重编）。
3. **接上 Tunnel**：第一个节点已经接好了——Tunnel win-gw-lou 里加了公开主机名 `run-lou1.codingdance.cn` → `http://localhost:8790`，DNS 也加了（2026-11-18）。
   用 Hyper-V 的话要把它改成 `http://<虚拟机 IP>:8790`（控制台 → Zero Trust → Networks → Tunnels → win-gw-lou → Public Hostname），并在虚拟机里 `ufw allow from <宿主 IP> to any port 8790` 只放宿主进来。不要动已有的 `test-code.cgent.link`。
4. **网站**：`site/wrangler.toml` 的 `RUNNER_NODES` 设成 `lou1=https://run-lou1.codingdance.cn`；Pages 的加密环境变量 `RUNNER_SECRET` 设成虚拟机 `/etc/lc-runner.env` 里的那个值（`sudo grep RUNNER_SECRET /etc/lc-runner.env`），重新部署网站。
5. **验证**：`curl https://run-lou1.codingdance.cn/healthz` 返回 `{"ok":true}`；网站的 `GET /api/run` 返回 `"available": true, "up": 1`；在题目页把语言换成 Java 跑一下。

### 更新节点（改了镜像、加了语言之后）

在节点的虚拟机里，到仓库目录下（第一次装时 clone 的那份）：

```bash
git fetch origin && git checkout main && git pull --ff-only
RUNNER_NODE_ID=lou1 sudo -E bash tools/runner/deploy/setup.sh
```

它会重新构建镜像（第一次带上九种新语言要下载 2 GB 左右的工具链）、把镜像转成新的 ext4 根文件系统、重启 fc-manager 和运行器；密钥和节点编号不变。要留出 25 GB 左右的磁盘（镜像 7 GB 多、转换时的临时目录和 ext4 各一份），耗时 10–30 分钟。更新时这个节点会下线一会儿，网站显示云端运行器不在线（只有一个节点时）。

装好后核对：网站的 `GET /api/run` 返回的 `langs` 里有 `kotlin`、`rust` 这些（节点的 `/v1/status` 要签名，直接看网站的就行）；题目页换成 Kotlin 跑一下两数之和。在这之前，新语言在练习区显示「云端运行器还没装上它」，不会去跑。

### 集群：加节点

1. 新开一台虚拟机或 KVM 主机，用**同一个密钥**、新的编号安装：
   ```bash
   RUNNER_NODE_ID=lou2 RUNNER_SECRET=<第一个节点的密钥> sudo -E bash tools/runner/deploy/setup.sh
   ```
2. 给它一个地址 `run-lou2.codingdance.cn`：在同一台宿主上就往 win-gw-lou 的 Tunnel 里加一条（指到新虚拟机的 IP 和端口）；在别的机器上就在那台机器上装 cloudflared、建一个 Tunnel。地址只用一级子域名（`run-<编号>.codingdance.cn`），Cloudflare 的免费证书只覆盖一级。
3. 网站的 `RUNNER_NODES` 后面加上 `,lou2=https://run-lou2.codingdance.cn`，重新部署。拿掉节点就从这里删掉它。

网站怎么挑节点（`site/functions/_lib/runner.ts`）：

- **同一个用户固定先去同一个节点**：按「用户名 + 节点编号」做加权的最高随机权重哈希（rendezvous hashing），权重是节点报的容量 `slots`。每个用户的限流（每分钟次数、同时一个）只在一个节点上算，所以算得准；以后做交互式调试，会话也一直在同一个节点上。加一个节点只会把一部分用户挪到新节点上，其他人不动。
- **满了、下线了就换**：节点状态每个 Worker 实例缓存 15 秒。状态显示满了的、上次连不上的（30 秒内）、不支持这门语言的排到后面；真去跑时返回 503（刚满）、5xx、连不上、签名不对，就换下一个节点。全都不行才告诉用户「云端运行器都忙或者不在线」。
- 节点之间不需要互相知道，也没有中心调度服务；节点表就是网站配置里的 `RUNNER_NODES`。以后节点多了、要自动上下线，可以改成节点定时向一个 Durable Object 报到，挑节点的逻辑不变。
- 同一个集群里各节点最好是同一个版本（`/v1/status` 的 `version`，就是装的时候仓库的提交）；更新时一台一台跑 `setup.sh`，正在更新的那台下线时用户会被换到别的节点。

可选：
- **再加一道门**：给 `run-*.codingdance.cn` 配一个 Cloudflare Access 应用，只放「服务令牌」；把令牌的 Client ID / Secret 设成 Pages 的加密环境变量 `RUNNER_ACCESS_ID` / `RUNNER_ACCESS_SECRET`。
- **没有 KVM 的机器**只能用 Docker 跑开发测试（`RUNNER_DRIVER=docker RUNNER_ALLOW_DOCKER=1`），不要拿来接公开用户的代码。
- **验证 microVM 这一层**：
  ```bash
  RUNNER_TEST_FC_URL=http://127.0.0.1:8097 RUNNER_TEST_FC_TOKEN=$(sudo sed -n 's/.*"sandbox\/fc-manager-token":"\([^"]*\)".*/\1/p' /etc/agentruntime/fc-manager-secrets.json) node tools/runner/test/sandbox.test.mjs
  ```

### 配置（`/etc/lc-runner.env`）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `RUNNER_NODE_ID` | — | 必填，这个节点的编号（小写字母、数字、横线），和网站 `RUNNER_NODES` 里的一样 |
| `RUNNER_SECRET` | — | 必填，至少 32 个字符，集群里所有节点和网站都一样 |
| `RUNNER_HOST` / `RUNNER_PORT` | `127.0.0.1` / `8790` | 监听地址 |
| `RUNNER_DRIVER` | `firecracker` | `firecracker`（生产）、`docker`（开发测试，要 `RUNNER_ALLOW_DOCKER=1`）、`local`（本机，要 `RUNNER_ALLOW_LOCAL=1`） |
| `RUNNER_FC_URL` / `RUNNER_FC_TOKEN` | `http://127.0.0.1:8097` / — | fc-manager 的地址和 API 令牌（setup.sh 从 fc-manager 的密钥文件里抄过来） |
| `RUNNER_FC_CPU_MILLIS` / `RUNNER_FC_MEMORY_MB` | 1000 / 1024 | 每台 microVM 的 CPU 和内存（要和 fc-manager 预热池的规格一样才用得上池子） |
| `RUNNER_SLOTS` / `RUNNER_QUEUE` | 2 / 20 | 同时运行几个、最多排队几个 |
| `RUNNER_IMAGE` / `RUNNER_POOL` / `RUNNER_MEMORY` / `RUNNER_CPUS` / `RUNNER_PIDS` | | 只有 docker 驱动用 |

fc-manager 自己的配置在 `/etc/agentruntime/fc-manager.env`（firecracker.sh 生成：只听 127.0.0.1、预热池 `lc-runner:1000:1024:2`、最多 8 台 VM），各项见 agent-runtime 的 `services/rs-fc-manager/src/config.rs`。
| `RUNNER_USER_PER_MIN` | 20 | 每个用户每分钟最多几次 |
| `RUNNER_CASE_MS` / `RUNNER_TOTAL_MS` | 3000 / 30000 | 每组、每次的时间上限 |

## 本机开发和测试

```bash
node tools/runner/test/sandbox.test.mjs          # 不隔离，只测本机装了工具链的语言
node tools/runner/test/server.test.mjs
RUNNER_DRIVER=local RUNNER_ALLOW_LOCAL=1 RUNNER_NODE_ID=dev RUNNER_SECRET=$(openssl rand -hex 32) node tools/runner/server.mjs
cd site && node functions/_lib/test/runner.test.ts   # 网站这边：签名、挑节点、固定节点、换节点（起几个本机节点）
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
- Python / JavaScript / TypeScript 在云端调试：现在选了云端也是在浏览器里调试（浏览器里有执行记录），运行器只调试 Java、C++、Go。
- 判题用例里超大的输入（卡复杂度的 n = 10⁵）：Java 的用例写成字面量，单个方法超过 64 KB 会编译不过，要改成从文件读。
