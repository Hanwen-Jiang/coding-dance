# 远端运行器的沙箱镜像：十五种语言的工具链 + 调试器（gdb、dlv、JDI）+ 沙箱程序。
# 在仓库根目录构建：docker build -f tools/runner/image/Dockerfile -t lc-runner:latest .
# 每次运行都在这个镜像起的一个新容器里（不能上网、根文件系统只读、普通用户），参数见 tools/runner/lib/sandbox.mjs。
# 各语言一层，改了沙箱程序只重做最后几层；版本尽量和力扣的运行环境接近（力扣「语言环境」说明）。
FROM ubuntu:24.04

ARG NODE_VERSION=24.11.1
ARG GO_VERSION=1.23.4
ARG DLV_VERSION=1.24.0
ARG KOTLIN_VERSION=2.1.20
ARG SCALA_VERSION=2.13.16
ARG SWIFT_VERSION=6.1
ARG RUST_VERSION=1.86.0
ARG DART_VERSION=3.7.2

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 LC_ALL=C.UTF-8

# Python、Java、C / C++（gcc、g++、gdb，力扣的 C 能用 uthash）、Ruby、PHP、C#（.NET 8）
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl xz-utils unzip python3 openjdk-21-jdk-headless gcc g++ gdb uthash-dev \
    ruby php8.3-cli php8.3-mbstring dotnet-sdk-8.0 \
    binutils libc6-dev libgcc-13-dev libstdc++-13-dev libsqlite3-0 libncurses6 libxml2 libcurl4 libedit2 tzdata zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" | tar -xJ -C /opt \
 && ln -s "/opt/node-v${NODE_VERSION}-linux-x64/bin/node" /usr/local/bin/node \
 && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | tar -xz -C /usr/local

ENV PATH=/usr/local/go/bin:$PATH GOTOOLCHAIN=local CGO_ENABLED=0

# GOPROXY：本机构建连不上 proxy.golang.org 时可以 --build-arg GOPROXY=https://goproxy.cn,direct
ARG GOPROXY=https://proxy.golang.org,direct
RUN GOPROXY="$GOPROXY" GOBIN=/usr/local/bin GOCACHE=/tmp/gocache GOPATH=/tmp/gopath go install "github.com/go-delve/delve/cmd/dlv@v${DLV_VERSION}" \
 && rm -rf /tmp/gocache /tmp/gopath

# Kotlin（编译器跑在 JDK 21 上）
RUN curl -fsSL -o /tmp/kotlin.zip "https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip" \
 && unzip -q /tmp/kotlin.zip -d /opt && rm /tmp/kotlin.zip \
 && ln -s /opt/kotlinc/bin/kotlinc /usr/local/bin/kotlinc

# Scala 2.13（和力扣一样是 2.13）
RUN curl -fsSL "https://github.com/scala/scala/releases/download/v${SCALA_VERSION}/scala-${SCALA_VERSION}.tgz" | tar -xz -C /opt \
 && ln -s "/opt/scala-${SCALA_VERSION}" /opt/scala \
 && ln -s /opt/scala/bin/scalac /usr/local/bin/scalac

# Swift（去掉用不上的 SourceKit、LLDB、SwiftPM、docc、静态库，省 1 GB 多）
RUN curl -fsSL "https://download.swift.org/swift-${SWIFT_VERSION}-release/ubuntu2404/swift-${SWIFT_VERSION}-RELEASE/swift-${SWIFT_VERSION}-RELEASE-ubuntu24.04.tar.gz" | tar -xz -C /opt \
 && ln -s "/opt/swift-${SWIFT_VERSION}-RELEASE-ubuntu24.04" /opt/swift \
 && cd /opt/swift/usr \
 && rm -rf bin/sourcekit-lsp bin/swift-package* bin/swift-build bin/swift-test bin/swift-run bin/swift-sdk bin/swift-experimental-sdk \
    bin/lldb* bin/clangd bin/docc bin/swift-format bin/swift-build-sdk-interfaces bin/swift-help bin/llvm-profdata bin/llvm-cov \
    lib/libsourcekitdInProc.so lib/liblldb.so* lib/swift_static lib/swift/pm share/docc \
 && find bin lib -xtype l -delete \
 && ln -s /opt/swift/usr/bin/swiftc /usr/local/bin/swiftc

# Rust（只装 rustc 和标准库）
RUN curl -fsSL "https://static.rust-lang.org/dist/rust-${RUST_VERSION}-x86_64-unknown-linux-gnu.tar.xz" | tar -xJ -C /tmp \
 && /tmp/rust-${RUST_VERSION}-x86_64-unknown-linux-gnu/install.sh --prefix=/opt/rust --components=rustc,rust-std-x86_64-unknown-linux-gnu --disable-ldconfig > /dev/null \
 && rm -rf /tmp/rust-* /opt/rust/share/doc \
 && ln -s /opt/rust/bin/rustc /usr/local/bin/rustc

# Dart
RUN curl -fsSL -o /tmp/dart.zip "https://storage.googleapis.com/dart-archive/channels/stable/release/${DART_VERSION}/sdk/dartsdk-linux-x64-release.zip" \
 && unzip -q /tmp/dart.zip -d /opt && rm /tmp/dart.zip \
 && ln -s /opt/dart-sdk/bin/dart /usr/local/bin/dart

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DART_SUPPRESS_ANALYTICS=true

# 判题器（生成参数和输出的代码，和 CI 判官方题解的是同一份）和沙箱程序
COPY tools/illustrations/judge /opt/lc/tools/illustrations/judge
COPY tools/illustrations/pytest_prelude.py /opt/lc/tools/illustrations/pytest_prelude.py
COPY tools/runner/sandbox /opt/lc/tools/runner/sandbox

ENV RUNNER_PREPARED=/opt/lc/prepared RUNNER_WORK=/work PYTHON=python3 HOME=/tmp
RUN node /opt/lc/tools/runner/sandbox/prepare.js && rm -rf /tmp/* /root/.cache

RUN useradd --uid 10001 --no-create-home --home-dir /tmp --shell /usr/sbin/nologin runner
USER 10001
WORKDIR /work
