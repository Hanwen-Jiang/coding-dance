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

	"github.com/Hanwen-Jiang/coding-dance/internal/api"
	"github.com/Hanwen-Jiang/coding-dance/internal/runner"
)

func main() {
	cfg := api.LoadConfigFromEnv()
	if len(cfg.SessionSecret) < 16 {
		fmt.Fprintln(os.Stderr, "SESSION_SECRET 必须配置（用于兼容加解密 hot100_session Cookie 及加密 Git 同步令牌）")
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	srv := api.NewServer(cfg, nil, nil, runner.DefaultJSONLogger)
	srv.Worker.Start(ctx)
	srv.Metrics.StartOTLPPusher(ctx, cfg.OTLPEndpoint, 15*time.Second)

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
	runner.DefaultJSONLogger(map[string]any{
		"event":        "listening",
		"binary":       "cd-api",
		"host":         cfg.Host,
		"port":         cfg.Port,
		"runnerNodes":  len(cfg.RunnerNodes),
		"valkey":       cfg.ValkeyAddr != "",
		"companion":    srv.Companion.Configured(),
		"siteOrigins":  cfg.SiteOrigins,
		"progressRepo": cfg.ProgressRepo,
	})

	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(shutCtx)
		srv.Worker.FlushReady(context.Background())
	}()

	if err := httpSrv.Serve(ln); err != nil && err != http.ErrServerClosed {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
}
