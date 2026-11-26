#!/usr/bin/env bash
# 节点启动 / 更新后的 Page Cache 预热脚本（宿主机零 Node.js 依赖）：
# 1. 预读 Firecracker 客户机内核到宿主机 Page Cache；
# 2. 等待本地 cd-runner 就绪后，对高频语言各跑一次轻量 ACM 任务，
#    把镜像 rootfs 中对应的编译器与运行时页块提前拉进宿主机内存缓存，避免首个真实用户请求撞上冷磁盘 I/O。
set -euo pipefail

ENV_FILE="${RUNNER_ENV_FILE:-/etc/lc-runner.env}"
if [ -r "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

HOST="${RUNNER_HOST:-127.0.0.1}"
if [ "$HOST" = "0.0.0.0" ] || [ -z "$HOST" ]; then
  HOST="127.0.0.1"
fi
PORT="${RUNNER_PORT:-8790}"
BASE_URL="${RUNNER_WARMUP_URL:-http://${HOST}:${PORT}}"
NODE_ID="${RUNNER_NODE_ID:-}"
SECRET="${RUNNER_SECRET:-}"
LANGS="${RUNNER_WARMUP_LANGS:-java cpp go python javascript}"
KERNEL="${RUNNER_WARMUP_KERNEL:-/var/lib/agentruntime/fc/images/vmlinux}"

if [ -z "$NODE_ID" ] || [ ${#SECRET} -lt 32 ]; then
  echo "warmup: 缺少有效的 RUNNER_NODE_ID 或 RUNNER_SECRET（至少 32 位），跳过预热" >&2
  exit 1
fi

sha256_hex() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  else
    openssl dgst -sha256 -hex | awk '{print $NF}'
  fi
}

hmac_sha256_hex() {
  printf '%s' "$1" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}'
}

json_num() {
  local json="$1" key="$2"
  printf '%s' "$json" | sed -n "s/.*\"${key}\":[[:space:]]*\([0-9][0-9]*\).*/\1/p" | head -n1
}

if [ -r "$KERNEL" ]; then
  cat "$KERNEL" > /dev/null 2>&1 || true
  echo "warmup: 已预读客户机内核到 Page Cache ($KERNEL)"
fi

ready=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 "${BASE_URL}/healthz" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "warmup: cd-runner (${BASE_URL}/healthz) 在 30 秒内未就绪" >&2
  exit 1
fi

code_for_lang() {
  case "$1" in
    java)       printf '%s' 'import java.util.*; public class Main { public static void main(String[] args) { System.out.println(\"ok\"); } }' ;;
    cpp)        printf '%s' '#include <bits/stdc++.h>\nusing namespace std;\nint main() { cout << \"ok\\n\"; }\n' ;;
    go)         printf '%s' 'package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"ok\") }\n' ;;
    python)     printf '%s' 'print(\"ok\")\n' ;;
    javascript) printf '%s' 'console.log(\"ok\");\n' ;;
    typescript) printf '%s' 'const msg: string = \"ok\"; console.log(msg);\n' ;;
    c)          printf '%s' '#include <stdio.h>\nint main() { puts(\"ok\"); return 0; }\n' ;;
    rust)       printf '%s' 'fn main() { println!(\"ok\"); }\n' ;;
    *)          return 1 ;;
  esac
}

failures=0
for lang in $LANGS; do
  if ! code="$(code_for_lang "$lang")"; then
    echo "warmup: 跳过未知语言 $lang" >&2
    continue
  fi
  body="$(printf '{"lang":"%s","mode":"acm","code":"%s","cases":[{"stdin":""}]}' "$lang" "$code")"
  ts="$(date +%s)"
  nonce="$(openssl rand -hex 12)"
  body_hash="$(printf '%s' "$body" | sha256_hex)"
  canonical="$(printf 'POST\n/v1/run\n%s\n%s\nwarmup\n%s\n%s' "$ts" "$nonce" "$NODE_ID" "$body_hash")"
  sig="$(hmac_sha256_hex "$canonical")"

  resp="$(curl -sS --max-time 60 -w '\n%{http_code}' \
    -X POST "${BASE_URL}/v1/run" \
    -H "Content-Type: application/json" \
    -H "X-Runner-Time: ${ts}" \
    -H "X-Runner-Nonce: ${nonce}" \
    -H "X-Runner-User: warmup" \
    -H "X-Runner-Node: ${NODE_ID}" \
    -H "X-Runner-Signature: ${sig}" \
    --data "$body" || true)"
  http_code="${resp##*$'\n'}"
  payload="${resp%$'\n'*}"

  if [ "$http_code" != "200" ]; then
    echo "warmup: ${lang} 失败 (HTTP ${http_code}): ${payload}" >&2
    failures=$((failures + 1))
    continue
  fi

  boot_ms="$(json_num "$payload" bootMs)"
  compile_ms="$(json_num "$payload" compileMs)"
  run_ms="$(json_num "$payload" runMs)"
  total_ms="$(json_num "$payload" totalMs)"
  printf 'warmup: %-10s ok  bootMs=%s compileMs=%s runMs=%s totalMs=%s\n' \
    "$lang" "${boot_ms:--}" "${compile_ms:--}" "${run_ms:--}" "${total_ms:--}"
done

if [ "$failures" -gt 0 ]; then
  echo "warmup: 完成，但有 ${failures} 项失败" >&2
  exit 1
fi
echo "warmup: 全部预热完成 (${NODE_ID})"
