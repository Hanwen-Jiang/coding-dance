#!/usr/bin/env bash
# 装一个运行器节点（Linux 主机，或者 win-gw-lou 上开了嵌套虚拟化的 Ubuntu 虚拟机）：
# 编译 Go 静态单二进制 cd-runner（宿主机零 Node.js 运行时依赖）、装 Firecracker 这一层（firecracker.sh）、启动 systemd 服务。
# 再跑一次就是更新（重新构建镜像和 microVM 的根文件系统、换上新的 cd-runner 二进制、重启），密钥和节点编号不变。
# 每台机器是集群里的一个节点，各有一个编号（网站的 RUNNER_NODES 里写同一个），所有节点共用一个密钥：
#   RUNNER_NODE_ID=lou1 sudo -E bash tools/runner/deploy/setup.sh                        # 第一个节点（在仓库根目录），会生成密钥
#   RUNNER_NODE_ID=lou2 RUNNER_SECRET=<第一个节点的密钥> sudo -E bash tools/runner/deploy/setup.sh   # 再加节点：用同一个密钥
#   RUNNER_LISTEN=0.0.0.0 …      Hyper-V 虚拟机：让宿主上的 cloudflared 经虚拟机 IP 访问（默认只听 127.0.0.1，WSL2 用）
#   RUNNER_POOL=4 …              预热池常备几台 microVM（默认 2）
# 每次运行都在一台新的 Firecracker microVM 里（自己的内核、没有网卡）。没有 KVM 的机器只能用 Docker 跑开发测试：
#   RUNNER_DRIVER=docker RUNNER_ALLOW_DOCKER=1 …   （和宿主共用内核，**不要**拿来跑公开用户的代码）
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP=/opt/lc-runner
ENV_FILE=/etc/lc-runner.env
GO_VERSION=1.25.4
DRIVER="${RUNNER_DRIVER:-firecracker}"

[ "$(id -u)" = 0 ] || { echo "要用 sudo 运行"; exit 1; }
if [ ! -f "$ENV_FILE" ] && ! [[ "${RUNNER_NODE_ID:-}" =~ ^[a-z0-9][a-z0-9-]{0,31}$ ]]; then
  echo "第一次安装要给这个节点起个编号：RUNNER_NODE_ID=lou1 sudo -E bash $0（小写字母、数字、横线）"
  exit 1
fi
if [ "$DRIVER" = docker ] && [ "${RUNNER_ALLOW_DOCKER:-}" != 1 ]; then
  echo "Docker 和宿主共用内核，挡不住内核漏洞，只能开发测试用。确定的话加上 RUNNER_ALLOW_DOCKER=1"
  exit 1
fi

echo "== 编译 Go 单二进制 cd-runner（宿主机零 Node.js 依赖） =="
if ! command -v go >/dev/null 2>&1; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) GOARCH_DL=amd64 ;;
    aarch64|arm64) GOARCH_DL=arm64 ;;
    *) echo "不支持的架构: $ARCH"; exit 1 ;;
  esac
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GOARCH_DL}.tar.gz" | tar -xz -C /usr/local
  export PATH="/usr/local/go/bin:$PATH"
fi
VERSION="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)"
( cd "$REPO" && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /usr/local/bin/cd-runner ./cmd/cd-runner )
chmod 0755 /usr/local/bin/cd-runner

id lc-runner >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin lc-runner
if [ "$DRIVER" = firecracker ]; then
  echo "== Firecracker（agent-runtime 的 fc-manager、客户机内核、根文件系统） =="
  RUNNER_IMAGE="lc-runner:$VERSION" bash "$REPO/tools/runner/deploy/firecracker.sh"
  FC_TOKEN="$(sed -n 's/.*"sandbox\/fc-manager-token":"\([^"]*\)".*/\1/p' /etc/agentruntime/fc-manager-secrets.json)"
  [ -n "$FC_TOKEN" ] || { echo "读不到 fc-manager 的令牌"; exit 1; }
  gpasswd -d lc-runner docker >/dev/null 2>&1 || true
else
  echo "== Docker（开发测试用） =="
  command -v docker >/dev/null || { apt-get update && apt-get install -y docker.io; }
  systemctl enable --now docker
  docker build -f "$REPO/tools/runner/image/Dockerfile" -t lc-runner:latest -t "lc-runner:$VERSION" "$REPO"
  usermod -aG docker lc-runner
  FC_TOKEN=""
fi

mkdir -p "$APP"
chown -R root:root "$APP"

if [ ! -f "$ENV_FILE" ]; then
  SECRET="${RUNNER_SECRET:-$(openssl rand -hex 32)}"
  cat > "$ENV_FILE" <<EOF
# 远端运行器的配置（见 tools/runner/README.md）。RUNNER_SECRET 集群里所有节点一样，也和网站 Pages / cd-api 的 RUNNER_SECRET 一样。
RUNNER_NODE_ID=$RUNNER_NODE_ID
RUNNER_SECRET=$SECRET
RUNNER_HOST=${RUNNER_LISTEN:-127.0.0.1}
RUNNER_PORT=8790
RUNNER_SLOTS=${RUNNER_SLOTS:-2}
RUNNER_QUEUE=20
RUNNER_USER_PER_MIN=20
EOF
  chmod 600 "$ENV_FILE"
  [ -n "${RUNNER_SECRET:-}" ] || echo "新生成了密钥，写在 $ENV_FILE 里（只有 root 能读）。把同一个值设成网站的 RUNNER_SECRET，以后加节点也用它。"
fi
# 每次更新时重写的几项
sed -i '/^RUNNER_VERSION=/d;/^RUNNER_DRIVER=/d;/^RUNNER_ALLOW_DOCKER=/d;/^RUNNER_FC_TOKEN=/d;/^RUNNER_IMAGE=/d' "$ENV_FILE"
{
  echo "RUNNER_VERSION=$VERSION"
  echo "RUNNER_DRIVER=$DRIVER"
  if [ "$DRIVER" = firecracker ]; then echo "RUNNER_FC_TOKEN=$FC_TOKEN"; else echo "RUNNER_ALLOW_DOCKER=1"; echo "RUNNER_IMAGE=lc-runner:latest"; fi
} >> "$ENV_FILE"

install -m 644 "$REPO/tools/runner/deploy/lc-runner.service" /etc/systemd/system/lc-runner.service
systemctl daemon-reload
systemctl enable lc-runner
systemctl restart lc-runner
sleep 2
systemctl --no-pager --lines=5 status lc-runner || true
PORT="$(grep '^RUNNER_PORT=' "$ENV_FILE" | cut -d= -f2)"
curl -fsS "http://127.0.0.1:${PORT}/healthz" && echo " ← cd-runner 服务起来了"
NODE="$(grep '^RUNNER_NODE_ID=' "$ENV_FILE" | cut -d= -f2)"
echo "节点 $NODE 装好了（cd-runner / $DRIVER）。下一步：Tunnel 里加公开主机名 run-$NODE.codingdance.cn 指到这个服务，"
echo "再把「$NODE=https://run-$NODE.codingdance.cn」加进 RUNNER_NODES（见 README「接上 Tunnel」）。"
