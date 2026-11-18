#!/usr/bin/env bash
# 装 Firecracker 这一层（setup.sh 调它；也可以单独跑来更新）：每次运行一台 microVM，用 agent-runtime 现成的部件，不另写：
#   - fc-manager（services/rs-fc-manager）：宿主上管 microVM 的服务，jailer 隔离、cgroup v2 上限、预热池、经 vsock 转给客户机 agent
#   - sandbox-agent（services/rs-sandbox-agent）：客户机里的 PID 1，HTTP 接受执行命令
#   - 客户机内核（deploy/images/firecracker/build-kernel.sh：没有网卡、没有模块）和 rootfs 转换（rootfs.sh：Docker 镜像 → 只读 ext4）
#   - Firecracker 与 jailer 的版本和 sha256（deploy/cluster/versions.conf）
# agent-runtime 固定在 AGENT_RUNTIME_REF 这个提交（换版本时改这里，再跑一遍）。
#
#   sudo bash tools/runner/deploy/firecracker.sh          # 在仓库根目录；要有 /dev/kvm
#
# 产物：/usr/local/bin/{firecracker,jailer,fc-manager}、/var/lib/agentruntime/fc/images/{vmlinux,lc-runner.ext4}、
#       /etc/agentruntime/fc-manager.env、/etc/agentruntime/fc-manager-secrets.json（API 令牌，只给 root）、fc-manager 服务。
set -euo pipefail

AGENT_RUNTIME_REPO="${AGENT_RUNTIME_REPO:-https://github.com/Hanwen-Jiang/agent-runtime.git}"
AGENT_RUNTIME_REF="${AGENT_RUNTIME_REF:-da58416909fc54f02519de95706df01d9bbd1701}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# CI 里已经检出了 agent-runtime、构建好了镜像：AGENT_RUNTIME_SRC 指到检出的目录，SKIP_IMAGE_BUILD=1 不再构建镜像
SRC="${AGENT_RUNTIME_SRC:-/opt/lc-runner/agent-runtime}"
IMAGES=/var/lib/agentruntime/fc/images
SECRETS=/etc/agentruntime/fc-manager-secrets.json
IMAGE="${RUNNER_IMAGE:-lc-runner:latest}"
POOL="${RUNNER_POOL:-2}"

die() { printf '错误：%s\n' "$*" >&2; exit 1; }
log() { printf '==> %s\n' "$*"; }

[ "$(id -u)" = 0 ] || die "要用 sudo 运行"
[ -e /dev/kvm ] || die "没有 /dev/kvm：Firecracker 要 KVM。虚拟机里要开嵌套虚拟化（Hyper-V：Set-VMProcessor <虚拟机> -ExposeVirtualizationExtensions \$true；WSL2：%UserProfile%\\.wslconfig 里 [wsl2] nestedVirtualization=true），见 tools/runner/README.md"
[ "$(stat -fc %T /sys/fs/cgroup)" = cgroup2fs ] || die "/sys/fs/cgroup 不是 cgroup v2（fc-manager 要用它给每台 VM 设上限）"

log "装构建要用的包"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates build-essential flex bison bc libelf-dev libssl-dev musl-tools e2fsprogs file iproute2 xz-utils >/dev/null
command -v docker >/dev/null || apt-get install -y -qq docker.io >/dev/null
systemctl enable --now docker

log "取 agent-runtime（$AGENT_RUNTIME_REF）"
if [ -z "${AGENT_RUNTIME_SRC:-}" ]; then
  [ -d "$SRC/.git" ] || git clone -q --filter=blob:none "$AGENT_RUNTIME_REPO" "$SRC"
  git -C "$SRC" fetch -q origin "$AGENT_RUNTIME_REF" 2>/dev/null || git -C "$SRC" fetch -q origin
  git -C "$SRC" checkout -q --detach "$AGENT_RUNTIME_REF"
fi
[ "$(git -C "$SRC" rev-parse HEAD)" = "$AGENT_RUNTIME_REF" ] || die "$SRC 不在 $AGENT_RUNTIME_REF 这个提交上"

log "编译 fc-manager 和 sandbox-agent（Rust，静态链接；第一次要几分钟）"
if ! command -v cargo >/dev/null; then
  [ -f "$HOME/.cargo/env" ] || curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none >/dev/null
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi
# 工具链版本和 musl 目标由 agent-runtime 的 rust-toolchain.toml 决定，rustup 自动装
( cd "$SRC" && cargo build -q --release --locked --target x86_64-unknown-linux-musl -p fc-manager -p rs-sandbox-agent )
BIN="${CARGO_TARGET_DIR:-$SRC/target}/x86_64-unknown-linux-musl/release"

log "装 Firecracker 和 jailer（版本和 sha256 按 agent-runtime 的 versions.conf 核对）"
# shellcheck disable=SC1091
source "$SRC/deploy/cluster/versions.conf"
if [[ "$(firecracker --version 2>/dev/null | head -1)" != *"${FIRECRACKER_VERSION#v}"* ]]; then
  tmp="$(mktemp -d)"
  tgz="firecracker-${FIRECRACKER_VERSION}-x86_64.tgz"
  curl -fsSL -o "$tmp/$tgz" "https://github.com/firecracker-microvm/firecracker/releases/download/${FIRECRACKER_VERSION}/$tgz"
  echo "${FIRECRACKER_SHA256}  $tmp/$tgz" | sha256sum -c - >/dev/null || die "$tgz 的 sha256 不对"
  tar -xzf "$tmp/$tgz" -C "$tmp"
  install -m 0755 "$tmp/release-${FIRECRACKER_VERSION}-x86_64/firecracker-${FIRECRACKER_VERSION}-x86_64" /usr/local/bin/firecracker
  install -m 0755 "$tmp/release-${FIRECRACKER_VERSION}-x86_64/jailer-${FIRECRACKER_VERSION}-x86_64" /usr/local/bin/jailer
  rm -rf "$tmp"
fi
install -m 0755 "$BIN/fc-manager" /usr/local/bin/fc-manager

log "客户机内核"
install -d -m 0700 "$IMAGES"
kconf="$(cat "$SRC/deploy/images/firecracker/kernel.conf" "$SRC/deploy/images/firecracker/agentruntime.config" | sha256sum | cut -c1-16)"
if [ ! -f "$IMAGES/vmlinux" ] || [ "$(cat "$IMAGES/vmlinux.key" 2>/dev/null)" != "$kconf" ]; then
  out="$(mktemp -d)"
  bash "$SRC/deploy/images/firecracker/build-kernel.sh" "$out"
  install -m 0644 "$out/vmlinux" "$IMAGES/vmlinux"
  echo "$kconf" > "$IMAGES/vmlinux.key"
  rm -rf "$out"
fi

log "沙箱镜像 → microVM 的根文件系统"
[ "${SKIP_IMAGE_BUILD:-}" = 1 ] || docker build -q -f "$REPO/tools/runner/image/Dockerfile" -t "$IMAGE" "$REPO" >/dev/null
bash "$SRC/deploy/images/firecracker/rootfs.sh" lc-runner "$IMAGE" "$BIN/sandbox-agent" "$IMAGES"

log "fc-manager 的配置"
install -d -m 0700 /etc/agentruntime
if [ ! -f "$SECRETS" ]; then
  token="$(openssl rand -hex 32)"
  umask 077
  printf '{"version":1,"scopes":{"_platform":{"secrets":{"sandbox/fc-manager-token":"%s"},"roles":[]}}}\n' "$token" > "$SECRETS"
fi
chmod 0600 "$SECRETS"
cat > /etc/agentruntime/fc-manager.env <<EOF
# setup 生成（tools/runner/deploy/firecracker.sh），重跑会覆盖。各项的意思见 agent-runtime 的 services/rs-fc-manager/src/config.rs。
# 只听本机：只有同一台机器上的运行器（server.mjs）调它。客户机没有网卡，也不配出网目标（AR_FC_EGRESS_TARGET）。
AR_FC_LISTEN=127.0.0.1:8097
AR_SECRETS_FILE=$SECRETS
AR_FC_STATE_DIR=/var/lib/agentruntime/fc/state
AR_FC_CHROOT_BASE=/var/lib/agentruntime/fc/jail
AR_FC_IMAGES_DIR=$IMAGES
AR_FC_KERNEL=$IMAGES/vmlinux
AR_FC_JAILER_BIN=/usr/local/bin/jailer
AR_FC_FIRECRACKER_BIN=/usr/local/bin/firecracker
AR_FC_IP_BIN=$(command -v ip)
AR_FC_MKFS_BIN=$(command -v mkfs.ext4)
AR_FC_UID_BASE=900000
# 预热池：常备几台空的 lc-runner microVM（1 核、1 GiB），交出一台后补满
AR_FC_WARM_POOL=lc-runner:1000:1024:$POOL
AR_FC_MAX_VMS=${RUNNER_FC_MAX_VMS:-8}
AR_FC_MAX_VCPUS=${RUNNER_FC_MAX_VCPUS:-8}
AR_FC_MAX_MEMORY_MIB=${RUNNER_FC_MAX_MEMORY_MIB:-10240}
AR_FC_VM_DEFAULT_DISK_MIB=1024
AR_FC_VM_MAX_VCPUS=2
AR_FC_VM_MAX_MEMORY_MIB=2048
EOF
chmod 0600 /etc/agentruntime/fc-manager.env
install -m 0644 "$REPO/tools/runner/deploy/fc-manager.service" /etc/systemd/system/fc-manager.service
systemctl daemon-reload
( set -a && source /etc/agentruntime/fc-manager.env && /usr/local/bin/fc-manager check ) || die "fc-manager check 没通过"
systemctl enable fc-manager
systemctl restart fc-manager
for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:8097/healthz >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:8097/healthz >/dev/null || die "fc-manager 没起来：journalctl -u fc-manager"
log "Firecracker 这一层装好了（agent-runtime $AGENT_RUNTIME_REF，预热池 $POOL 台）"
