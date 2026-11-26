# 远端运行器 `cd-runner`（云端运行 / 判题 / WebSocket DAP 调试 / OTel 遥测）

Java、C++、Go 的练习交给这里运行和调试（同时支持一次性执行记录与交互式 WebSocket DAP 真调试器），C、C#、Kotlin、Swift、Rust、Ruby、PHP、Scala、Dart 交给这里运行。Python、JavaScript、TypeScript 默认在浏览器里跑，用户在练习区选了「云端」时运行和测试也交给这里。

```
浏览器 ──POST /api/run | WSS /api/dap──▶ 网站（认登录、扣额度、加权 Rendezvous 挑节点、HMAC 签名）
                                            │
                                            ├──HTTPS/WSS──▶ run-lou1.codingdance.cn ─Tunnel─▶ 节点 lou1
                                            ├──HTTPS/WSS──▶ run-lou2.codingdance.cn ─Tunnel─▶ 节点 lou2
                                            └── …
每个节点宿主机（0 Node.js 依赖）：
  Go 单二进制 cd-runner（验签、限流、排队、DAP 桥接、OTel 指标）
    └── HTTP / Unix 调 fc-manager 交出全新无网卡 Firecracker microVM
          └── 客户机 Rust sandbox-agent 执行 sandbox.js / dap-session.js
```

## 核心特性

- **宿主机零 Node.js 运行时**：控制面由根模块编译为单一纯静态 Go 二进制 `cd-runner`（`CGO_ENABLED=0`），直接复用 [agent-runtime](https://github.com/Hanwen-Jiang/agent-runtime) 的 `fc-manager` 与客户机 `sandbox-agent`，并支持从 `/etc/agentruntime/fc-manager-secrets.json` 热读轮换令牌。
- **每次运行或调试独占一台 Firecracker microVM**：独立客户机内核、无网卡（仅 vsock）、只读根文件系统、普通用户 `10001:10001`、jailer + cgroup v2 + seccomp 隔离，用完即毁。开发与 CI 支持 `docker` 预热池驱动与 `local` 本机驱动。
- **双模真调试器（执行记录 + 交互式 WebSocket DAP）**：
  - 一次性执行记录（`POST /v1/run` 带 `debug: true`）：C++ 用 `gdb`、Java 用 `JdiTrace`、Go 用 `dlv` 记下完整步进轨迹，直接喂给前端时间旅行面板。
  - **交互式断点调试（`GET /v1/dap` WebSocket）**：沙箱内 `sandbox/dap-session.js` 复用同一套力扣/ACM 代码生成与编译链，拉起 `dlv dap`、`gdb -q -nx -i=dap` 或零外部依赖的 `JdiDap`（基于 JDK `com.sun.jdi.*`），自动完成编辑器行号偏移双向映射，支持断点停住、查看调用栈与变量、表达式求值、单步与空闲超时回收（默认 5 分钟空闲 / 30 分钟上限）。
- **OpenTelemetry 与 `#/admin` 联合监控**：暴露标准 Prometheus `GET /metrics`、签名保护的 `GET /v1/admin/telemetry`（网站边缘 `GET /api/admin/runner` 聚合全集群节点状态与耗时直方图），并支持后台周期推送至 `OTEL_EXPORTER_OTLP_ENDPOINT`。

## 目录结构

| 位置 | 作用 |
| --- | --- |
| `cmd/cd-runner/main.go` | Go 静态单二进制入口（配置校验、驱动初始化、OTLP 导出、优雅停机） |
| `internal/runner/sign.go` | 节点作用域 HMAC-SHA256 签名与防重放 `NonceCache`（与 `site/functions/_lib/runner.ts` 算法一致） |
| `internal/runner/driver.go` | 三种隔离驱动：`FirecrackerDriver`（生产 microVM）、`DockerPool`（开发和 CI 容器池）、`LocalDriver`（本机） |
| `internal/runner/dap.go` | `GET /v1/dap` WebSocket 升级、单用户并发保护、空闲回收与 `Content-Length` DAP 帧双向桥接 |
| `internal/runner/server.go` | HTTP 路由：`GET /healthz`、`GET /metrics`、`GET /v1/status`、`GET /v1/admin/telemetry`、`POST /v1/run`、`GET /v1/dap` |
| `tools/runner/sandbox/sandbox.js` | 客户机沙箱批处理入口：读任务、编译、逐组运行或生成调试记录 |
| `tools/runner/sandbox/dap-session.js` | 客户机沙箱交互式 DAP 入口：支持 `stdio`（Docker/Local）及 `daemon`/`poll`（Firecracker vsock RPC） |
| `tools/runner/sandbox/trace/` | 真调试器后端：`gdb_trace.py`、`JdiTrace.java`、`JdiDap.java`、`dlv.js` |
| `tools/runner/sandbox/prepare.js` | 构建镜像时预生成 C++ 预编译头、Go 标准库归档、`JdiTrace`/`JdiDap`、C# 引用列表与 Kotlin/Scala CDS 归档 |
| `tools/runner/image/Dockerfile` | 十五种语言工具链与调试器镜像（部署时经 `rootfs.sh` 转为 microVM 只读 ext4 根盘） |
| `tools/runner/deploy/` | 一键安装脚本 `setup.sh`（自动编译安装 `/usr/local/bin/cd-runner`）、`firecracker.sh` 与 systemd 服务单元 |
| `tools/runner/test/` | `sandbox.test.mjs`（经真实 `cd-runner` 跑十五种语言、执行记录、WebSocket DAP 断点与隔离检查）、`starters.test.mjs`（100 题起始代码编译核对） |

## 接口摘要

除 `GET /healthz` 与本机 `GET /metrics` 外，所有请求均需携带节点签名（`GET /v1/dap` 同时支持 URL 查询参数 `time,nonce,user,node,sig` 签名以便边缘侧 WebSocket Upgrade）：

```
X-Runner-Time: <Unix 秒>
X-Runner-Nonce: <16–64 位随机串>
X-Runner-User: <GitHub 用户名>
X-Runner-Node: <目标节点编号>
X-Runner-Signature: hex(HMAC-SHA256(RUNNER_SECRET, 方法 \n 路径 \n 时间 \n 随机串 \n 用户 \n 节点编号 \n hex(SHA-256(请求体))))
```

## 部署与更新节点（`win-gw-lou` 或 Linux KVM 主机）

```bash
git fetch origin && git checkout main && git pull --ff-only
RUNNER_NODE_ID=lou1 sudo -E bash tools/runner/deploy/setup.sh
```

`setup.sh` 会自动编译纯静态 `/usr/local/bin/cd-runner`（无需在宿主机安装 Node.js），调用 `firecracker.sh` 构建/更新 `fc-manager`、客户机内核与 `lc-runner.ext4` 根文件系统，并重启 `fc-manager` 与 `lc-runner` 服务。

## 本机开发与测试

```bash
# 1. Go 单元与竞态测试（含固定签名向量、假 fc-manager 协议、Java 力扣模式真 JDI WebSocket DAP 断点单步求值）
go test -race -v ./internal/runner/...

# 2. 启动本机开发 cd-runner 节点
RUNNER_DRIVER=local RUNNER_ALLOW_LOCAL=1 RUNNER_NODE_ID=dev RUNNER_SECRET=$(openssl rand -hex 32) go run ./cmd/cd-runner

# 3. 网站侧集群路由、故障切换与 #/admin 遥测测试（自动编译并拉起多个真实 cd-runner 节点）
cd site && node functions/_lib/test/runner.test.ts

# 4. 经真实 cd-runner 跑沙箱端到端测试（本机或指定 Docker 镜像 / Firecracker fc-manager）
node tools/runner/test/sandbox.test.mjs
RUNNER_TEST_IMAGE=lc-runner:dev node tools/runner/test/sandbox.test.mjs
```
