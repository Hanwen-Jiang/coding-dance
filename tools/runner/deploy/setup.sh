#!/usr/bin/env bash
# 在 win-gw-lou 上的 Ubuntu 虚拟机（Hyper-V / KVM 虚拟机或 WSL2）里运行：装 Docker 和 Node、构建沙箱镜像、装成 systemd 服务。
# 再跑一次就是更新（重新构建镜像、换上新的服务代码、重启服务），密钥不变。
#   sudo bash tools/runner/deploy/setup.sh            # 在仓库根目录
#   RUNNER_LISTEN=0.0.0.0 sudo -E bash …              # Hyper-V 虚拟机：让 Windows 上的 cloudflared 经虚拟机 IP 访问（默认只听 127.0.0.1，WSL2 用）
#   RUNNER_RUNTIME=runsc sudo -E bash …               # 用 gVisor 跑容器（要先装好 runsc，见 README）
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP=/opt/lc-runner
ENV_FILE=/etc/lc-runner.env
NODE_VERSION=24.11.1

[ "$(id -u)" = 0 ] || { echo "要用 sudo 运行"; exit 1; }

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
  SECRET="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<EOF
# 远端运行器的配置（见 tools/runner/README.md）。RUNNER_SECRET 要和网站 Pages 的加密环境变量 RUNNER_SECRET 一样。
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
  echo "新生成了密钥，写在 $ENV_FILE 里（只有 root 能读）。把同一个值设成网站的 RUNNER_SECRET。"
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
echo "下一步：在 Cloudflare Tunnel（win-gw-lou）里加一个公开主机名指到这个服务，见 README「接上 Tunnel」。"
