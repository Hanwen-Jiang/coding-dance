# 多分组 Cloudflare Containers 沙箱镜像（在仓库根目录构建）：
#   docker build --target runner-script -f tools/runner/cf/Dockerfile -t lc-runner-script:poc .
#   docker build --target runner-jvm    -f tools/runner/cf/Dockerfile -t lc-runner-jvm:poc .
#   docker build --target runner-native -f tools/runner/cf/Dockerfile -t lc-runner-native:poc .

FROM golang:1.25-bookworm AS cd-runner-builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/cd-runner ./cmd/cd-runner

FROM ubuntu:24.04 AS base
ARG NODE_VERSION=24.11.1
ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 LC_ALL=C.UTF-8

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" | tar -xJ -C /opt \
 && ln -s "/opt/node-v${NODE_VERSION}-linux-x64/bin/node" /usr/local/bin/node

COPY --from=cd-runner-builder /out/cd-runner /usr/local/bin/cd-runner
COPY tools/illustrations/judge /opt/lc/tools/illustrations/judge
COPY tools/illustrations/pytest_prelude.py /opt/lc/tools/illustrations/pytest_prelude.py
COPY tools/runner/sandbox /opt/lc/tools/runner/sandbox

RUN useradd --uid 10001 --no-create-home --home-dir /tmp --shell /usr/sbin/nologin runner \
 && mkdir -p /work /opt/lc/prepared \
 && chown 10001:10001 /work

ENV RUNNER_PREPARED=/opt/lc/prepared \
    RUNNER_WORK=/work \
    PYTHON=python3 \
    HOME=/tmp \
    RUNNER_DRIVER=local \
    RUNNER_ALLOW_LOCAL=1 \
    RUNNER_HOST=0.0.0.0 \
    RUNNER_PORT=8790 \
    RUNNER_SLOTS=4 \
    RUNNER_USER_PER_MIN=60
WORKDIR /opt/lc

# ── 分组 1：轻量脚本语言（Python / JavaScript / TypeScript / Ruby / PHP） ──
FROM base AS runner-script
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ruby php8.3-cli php8.3-mbstring php8.3-phpdbg \
 && rm -rf /var/lib/apt/lists/* \
 && RUNNER_PREPARE_GROUP=script node /opt/lc/tools/runner/sandbox/prepare.js \
 && rm -rf /tmp/* /root/.cache
USER 10001
EXPOSE 8790
ENTRYPOINT ["/usr/local/bin/cd-runner"]

# ── 分组 2：JVM 语言（Java + JdiTrace/JdiDap + javac CDS / Kotlin / Scala） ──
FROM base AS runner-jvm
ARG KOTLIN_VERSION=2.1.20
ARG SCALA_VERSION=2.13.16
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-21-jdk-headless unzip \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL -o /tmp/kotlin.zip "https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip" \
 && unzip -q /tmp/kotlin.zip -d /opt && rm /tmp/kotlin.zip \
 && ln -s /opt/kotlinc/bin/kotlinc /usr/local/bin/kotlinc \
 && curl -fsSL "https://github.com/scala/scala/releases/download/v${SCALA_VERSION}/scala-${SCALA_VERSION}.tgz" | tar -xz -C /opt \
 && ln -s "/opt/scala-${SCALA_VERSION}" /opt/scala \
 && ln -s /opt/scala/bin/scalac /usr/local/bin/scalac \
 && RUNNER_PREPARE_GROUP=jvm node /opt/lc/tools/runner/sandbox/prepare.js \
 && rm -rf /tmp/* /root/.cache
USER 10001
EXPOSE 8790
ENTRYPOINT ["/usr/local/bin/cd-runner"]

# ── 分组 3：原生编译与调试（C / C++ + gdb / Go + dlv / Rust） ──
FROM base AS runner-native
ARG GO_VERSION=1.23.4
ARG DLV_VERSION=1.24.0
ARG RUST_VERSION=1.86.0
ARG GOPROXY=https://proxy.golang.org,direct
ENV PATH=/usr/local/go/bin:$PATH GOTOOLCHAIN=local CGO_ENABLED=0
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc g++ gdb uthash-dev binutils libc6-dev libgcc-13-dev libstdc++-13-dev \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | tar -xz -C /usr/local \
 && GOPROXY="$GOPROXY" GOBIN=/usr/local/bin GOCACHE=/tmp/gocache GOPATH=/tmp/gopath go install "github.com/go-delve/delve/cmd/dlv@v${DLV_VERSION}" \
 && rm -rf /tmp/gocache /tmp/gopath \
 && curl -fsSL "https://static.rust-lang.org/dist/rust-${RUST_VERSION}-x86_64-unknown-linux-gnu.tar.xz" | tar -xJ -C /tmp \
 && /tmp/rust-${RUST_VERSION}-x86_64-unknown-linux-gnu/install.sh --prefix=/opt/rust --components=rustc,rust-std-x86_64-unknown-linux-gnu --disable-ldconfig > /dev/null \
 && rm -rf /tmp/rust-* /opt/rust/share/doc \
 && ln -s /opt/rust/bin/rustc /usr/local/bin/rustc \
 && RUNNER_PREPARE_GROUP=native node /opt/lc/tools/runner/sandbox/prepare.js \
 && rm -rf /tmp/* /root/.cache
USER 10001
EXPOSE 8790
ENTRYPOINT ["/usr/local/bin/cd-runner"]
