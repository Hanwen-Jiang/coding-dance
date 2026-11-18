# 远端运行器的沙箱镜像：六种语言的工具链 + 调试器（gdb、dlv、JDI）+ 沙箱程序。
# 在仓库根目录构建：docker build -f tools/runner/image/Dockerfile -t lc-runner:latest .
# 每次运行都在这个镜像起的一个新容器里（不能上网、根文件系统只读、普通用户），参数见 tools/runner/lib/sandbox.mjs。
FROM ubuntu:24.04

ARG NODE_VERSION=24.11.1
ARG GO_VERSION=1.23.4
ARG DLV_VERSION=1.24.0

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 LC_ALL=C.UTF-8

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl xz-utils python3 openjdk-21-jdk-headless g++ gdb \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" | tar -xJ -C /opt \
 && ln -s "/opt/node-v${NODE_VERSION}-linux-x64/bin/node" /usr/local/bin/node \
 && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | tar -xz -C /usr/local

ENV PATH=/usr/local/go/bin:$PATH GOTOOLCHAIN=local CGO_ENABLED=0

RUN GOBIN=/usr/local/bin GOCACHE=/tmp/gocache GOPATH=/tmp/gopath go install "github.com/go-delve/delve/cmd/dlv@v${DLV_VERSION}" \
 && rm -rf /tmp/gocache /tmp/gopath

# 判题器（生成参数和输出的代码，和 CI 判官方题解的是同一份）和沙箱程序
COPY tools/illustrations/judge /opt/lc/tools/illustrations/judge
COPY tools/illustrations/pytest_prelude.py /opt/lc/tools/illustrations/pytest_prelude.py
COPY tools/runner/sandbox /opt/lc/tools/runner/sandbox

ENV RUNNER_PREPARED=/opt/lc/prepared RUNNER_WORK=/work PYTHON=python3 HOME=/tmp
RUN node /opt/lc/tools/runner/sandbox/prepare.js && rm -rf /tmp/* /root/.cache

RUN useradd --uid 10001 --no-create-home --home-dir /tmp --shell /usr/sbin/nologin runner
USER 10001
WORKDIR /work
