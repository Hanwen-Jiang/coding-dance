package otel

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestRegistryPrometheusAndOTLPPush(t *testing.T) {
	reg := NewRegistry("cd-runner", "lou1")
	reg.IncCounter("cd_runner_jobs_total", map[string]string{"lang": "go", "status": "ok"})
	reg.SetGauge("cd_runner_slots_capacity", 4)
	reg.ObserveMs("cd_runner_job_duration_ms", 42.5, map[string]string{"lang": "go"})

	text := reg.PrometheusText()
	for _, needle := range []string{
		`cd_runner_jobs_total{service="cd-runner",node="lou1",lang="go",status="ok"} 1`,
		`cd_runner_slots_capacity{service="cd-runner",node="lou1"} 4`,
		`cd_runner_job_duration_ms_count{service="cd-runner",node="lou1",lang="go"} 1`,
	} {
		if !strings.Contains(text, needle) {
			t.Fatalf("missing %q in prometheus output:\n%s", needle, text)
		}
	}

	snap := reg.Snapshot()
	if snap["service"] != "cd-runner" || snap["node"] != "lou1" {
		t.Fatalf("unexpected snapshot: %#v", snap)
	}

	var pushed atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/metrics" && r.Method == http.MethodPost {
			pushed.Add(1)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	reg.StartOTLPPusher(ctx, srv.URL, 20*time.Millisecond)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) && pushed.Load() == 0 {
		time.Sleep(10 * time.Millisecond)
	}
	if pushed.Load() == 0 {
		t.Fatal("expected OTLP pusher to export metrics")
	}
}
