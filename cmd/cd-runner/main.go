package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/runner"
)

func main() {
	cfg := runner.LoadConfigFromEnv()
	if len(cfg.Secret) < 32 {
		fmt.Fprintln(os.Stderr, "RUNNER_SECRET 要设成至少 32 个字符的随机串（和网站的 RUNNER_SECRET 一样）")
		os.Exit(1)
	}
	if !runner.NodeIDPattern.MatchString(cfg.Node) {
		fmt.Fprintln(os.Stderr, "RUNNER_NODE_ID 要设成这个节点的编号（小写字母、数字、横线，比如 lou1），和网站 RUNNER_NODES 里写的一样")
		os.Exit(1)
	}
	if cfg.Driver == "local" && os.Getenv("RUNNER_ALLOW_LOCAL") != "1" {
		fmt.Fprintln(os.Stderr, "RUNNER_DRIVER=local 不隔离用户代码，只能本机开发用；确定的话再设 RUNNER_ALLOW_LOCAL=1")
		os.Exit(1)
	}
	if cfg.Driver == "docker" && os.Getenv("RUNNER_ALLOW_DOCKER") != "1" {
		fmt.Fprintln(os.Stderr, "RUNNER_DRIVER=docker 和宿主共用内核，只能开发和测试用；生产上用 firecracker。确定的话再设 RUNNER_ALLOW_DOCKER=1")
		os.Exit(1)
	}
	if cfg.Driver == "firecracker" && cfg.FCToken == "" && cfg.FCTokenFile == "" {
		fmt.Fprintln(os.Stderr, "RUNNER_DRIVER=firecracker 要设 RUNNER_FC_TOKEN 或 RUNNER_FC_TOKEN_FILE（fc-manager 的 API 令牌）")
		os.Exit(1)
	}

	var drv runner.Driver
	switch cfg.Driver {
	case "local":
		drv = &runner.LocalDriver{}
	case "docker":
		drv = &runner.DockerPool{
			Image:   cfg.Image,
			Size:    cfg.Pool,
			Runtime: cfg.Runtime,
			Memory:  cfg.Memory,
			CPUs:    cfg.CPUs,
			PIDs:    cfg.PIDs,
			LogFn:   runner.DefaultJSONLogger,
		}
	case "firecracker":
		drv = runner.NewFirecrackerDriver(runner.FirecrackerConfig{
			URL:       cfg.FCURL,
			Token:     cfg.FCToken,
			TokenFile: cfg.FCTokenFile,
			Runtime:   cfg.FCRuntime,
			CPUMillis: cfg.FCCPUMillis,
			MemoryMB:  cfg.FCMemoryMB,
			LogFn:     runner.DefaultJSONLogger,
		})
	default:
		fmt.Fprintf(os.Stderr, "不支持的 RUNNER_DRIVER=%s（可选 firecracker / docker / local）\n", cfg.Driver)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := drv.Init(ctx); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}

	srv := runner.NewServer(cfg, drv, runner.DefaultJSONLogger)
	srv.Metrics().StartOTLPPusher(ctx, cfg.OTLPEndpoint, 15*time.Second)

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	httpSrv := &http.Server{
		Addr:              addr,
		Handler:           srv,
		ReadHeaderTimeout: 10 * time.Second,
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
	rtName := cfg.Runtime
	if rtName == "" {
		rtName = "runc"
	}
	runner.DefaultJSONLogger(map[string]any{
		"event":   "listening",
		"binary":  "cd-runner",
		"node":    cfg.Node,
		"host":    cfg.Host,
		"port":    cfg.Port,
		"driver":  cfg.Driver,
		"image":   cfg.Image,
		"runtime": rtName,
	})

	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(shutCtx)
		_ = drv.Close()
	}()

	if err := httpSrv.Serve(ln); err != nil && err != http.ErrServerClosed {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
}
