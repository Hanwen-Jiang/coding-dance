#!/usr/bin/env bash
# 在 win-gw-lou 上的 Ubuntu 虚拟机（Hyper-V / KVM 虚拟机或 WSL2）里运行：装 Docker 和 Node、构建沙箱镜像、装成 systemd 服务。
# 再跑一次就是更新（重新构建镜像、换上新的服务代码、重启服务），密钥和节点编号不变。
# 每台虚拟机 / KVM 主机是集群里的一个节点，各有一个编号（网站的 RUNNER_NODES 里写同一个），所有节点共用一个密钥：
#   RUNNER_NODE_ID=lou1 sudo -E bash tools/runner/deploy/setup.sh                        # 第一个节点（在仓库根目录），会生成密钥
#   RUNNER_NODE_ID=lou2 RUNNER_SECRET=<第一个节点的密钥> sudo -E bash tools/runner/deploy/setup.sh   # 再加节点：用同一个密钥
#   RUNNER_LISTEN=0.0.0.0 …      Hyper-V 虚拟机：让宿主上的 cloudflared 经虚拟机 IP 访问（默认只听 127.0.0.1，WSL2 用）
#   RUNNER_RUNTIME=runsc …       用 gVisor 跑容器（要先装好 runsc，见 README）
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP=/opt/lc-runner
ENV_FILE=/etc/lc-runner.env
NODE_VERSION=24.11.1

[ "$(id -u)" = 0 ] || { echo "要用 sudo 运行"; exit 1; }
if [ ! -f "$ENV_FILE" ] && ! [[ "${RUNNER_NODE_ID:-}" =~ ^[a-z0-9][a-z0-9-]{0,31}$ ]]; then
  echo "第一次安装要给这个节点起个编号：RUNNER_NODE_ID=lou1 sudo -E bash $0（小写字母、数字、横线）"
  exit 1
fi

echo "== 装 Docker =="
if ! command -v docker >/dev/null; then
  apt-get update
  apt-get install -y docker.io
fi
systemctl enable --now docker

echo "== 装 Node $NODE_VERSION =="
if ! node --version 2>/dev/null | grep -q "^v24\."; then
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" | tar -xJ -C /opt
  ln -sf "/opt/node-v${NODE_VERSION}-linux-x64/bin/node" /usr/local/bin/node
fi

echo "== 构建沙箱镜像（第一次要几分钟） =="
VERSION="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)"
docker build -f "$REPO/tools/runner/image/Dockerfile" -t lc-runner:latest -t "lc-runner:$VERSION" "$REPO"

echo "== 服务代码 =="
id lc-runner >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin lc-runner
usermod -aG docker lc-runner
mkdir -p "$APP"
rm -rf "$APP/lib"
cp -r "$REPO/tools/runner/server.mjs" "$REPO/tools/runner/lib" "$APP/"
chown -R root:root "$APP"

if [ ! -f "$ENV_FILE" ]; then
  SECRET="${RUNNER_SECRET:-$(openssl rand -hex 32)}"
  cat > "$ENV_FILE" <<EOF
# 远端运行器的配置（见 tools/runner/README.md）。RUNNER_SECRET 集群里所有节点一样，也和网站 Pages 的加密环境变量 RUNNER_SECRET 一样。
RUNNER_NODE_ID=$RUNNER_NODE_ID
RUNNER_SECRET=$SECRET
RUNNER_HOST=${RUNNER_LISTEN:-127.0.0.1}
RUNNER_PORT=8790
RUNNER_IMAGE=lc-runner:latest
RUNNER_RUNTIME=${RUNNER_RUNTIME:-}
RUNNER_POOL=2
RUNNER_SLOTS=2
RUNNER_QUEUE=20
RUNNER_MEMORY=1g
RUNNER_CPUS=1
RUNNER_USER_PER_MIN=20
EOF
  chmod 600 "$ENV_FILE"
  [ -n "${RUNNER_SECRET:-}" ] || echo "新生成了密钥，写在 $ENV_FILE 里（只有 root 能读）。把同一个值设成网站的 RUNNER_SECRET，以后加节点也用它。"
fi
sed -i '/^RUNNER_VERSION=/d' "$ENV_FILE"
echo "RUNNER_VERSION=$VERSION" >> "$ENV_FILE"

install -m 644 "$REPO/tools/runner/deploy/lc-runner.service" /etc/systemd/system/lc-runner.service
systemctl daemon-reload
systemctl enable lc-runner
systemctl restart lc-runner
sleep 2
systemctl --no-pager --lines=5 status lc-runner || true
PORT="$(grep '^RUNNER_PORT=' "$ENV_FILE" | cut -d= -f2)"
curl -fsS "http://127.0.0.1:${PORT}/healthz" && echo " ← 服务起来了"
NODE="$(grep '^RUNNER_NODE_ID=' "$ENV_FILE" | cut -d= -f2)"
echo "节点 $NODE 装好了。下一步：Tunnel 里加公开主机名 run-$NODE.codingdance.cn 指到这个服务，"
echo "再把「$NODE=https://run-$NODE.codingdance.cn」加进网站 wrangler.toml 的 RUNNER_NODES（见 README「接上 Tunnel」）。"
