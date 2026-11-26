package otel

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var defaultBuckets = []float64{5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000}

// Registry provides dependency-free OpenTelemetry-aligned counters, gauges, and histograms
// with Prometheus exposition, #/admin JSON telemetry snapshots, and OTLP/HTTP periodic push.
type Registry struct {
	service   string
	node      string
	startedAt time.Time

	mu         sync.RWMutex
	counters   map[string]map[string]uint64
	gauges     map[string]float64
	gaugeFuncs map[string]func() float64
	hists      map[string]*histSeries
}

type histSeries struct {
	buckets []float64
	byLabel map[string]*histValue
}

type histValue struct {
	counts []uint64
	sum    float64
	count  uint64
}

func NewRegistry(service, node string) *Registry {
	return &Registry{
		service:    service,
		node:       node,
		startedAt:  time.Now(),
		counters:   make(map[string]map[string]uint64),
		gauges:     make(map[string]float64),
		gaugeFuncs: make(map[string]func() float64),
		hists:      make(map[string]*histSeries),
	}
}

func canonicalLabels(labels map[string]string) string {
	if len(labels) == 0 {
		return ""
	}
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(k)
		b.WriteString(`="`)
		b.WriteString(escapeProm(labels[k]))
		b.WriteByte('"')
	}
	return b.String()
}

func escapeProm(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`)
	return r.Replace(s)
}

func (r *Registry) IncCounter(name string, labels map[string]string) {
	r.AddCounter(name, 1, labels)
}

func (r *Registry) AddCounter(name string, delta uint64, labels map[string]string) {
	key := canonicalLabels(labels)
	r.mu.Lock()
	defer r.mu.Unlock()
	m := r.counters[name]
	if m == nil {
		m = make(map[string]uint64)
		r.counters[name] = m
	}
	m[key] += delta
}

func (r *Registry) SetGauge(name string, val float64) {
	r.mu.Lock()
	r.gauges[name] = val
	r.mu.Unlock()
}

func (r *Registry) RegisterGaugeFunc(name string, fn func() float64) {
	r.mu.Lock()
	r.gaugeFuncs[name] = fn
	r.mu.Unlock()
}

func (r *Registry) ObserveMs(name string, ms float64, labels map[string]string) {
	key := canonicalLabels(labels)
	r.mu.Lock()
	defer r.mu.Unlock()
	hs := r.hists[name]
	if hs == nil {
		hs = &histSeries{
			buckets: append([]float64(nil), defaultBuckets...),
			byLabel: make(map[string]*histValue),
		}
		r.hists[name] = hs
	}
	hv := hs.byLabel[key]
	if hv == nil {
		hv = &histValue{counts: make([]uint64, len(hs.buckets))}
		hs.byLabel[key] = hv
	}
	for i, bound := range hs.buckets {
		if ms <= bound {
			hv.counts[i]++
		}
	}
	hv.sum += ms
	hv.count++
}

// PrometheusText renders metrics in standard Prometheus text format 0.0.4.
func (r *Registry) PrometheusText() string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var b strings.Builder
	baseLbl := fmt.Sprintf(`service=%q,node=%q`, r.service, r.node)
	joinLbl := func(extra string) string {
		if extra == "" {
			return baseLbl
		}
		return baseLbl + "," + extra
	}

	b.WriteString("# TYPE cd_uptime_seconds gauge\n")
	fmt.Fprintf(&b, "cd_uptime_seconds{%s} %.3f\n", baseLbl, time.Since(r.startedAt).Seconds())

	counterNames := make([]string, 0, len(r.counters))
	for name := range r.counters {
		counterNames = append(counterNames, name)
	}
	sort.Strings(counterNames)
	for _, name := range counterNames {
		fmt.Fprintf(&b, "# TYPE %s counter\n", name)
		series := r.counters[name]
		lkeys := make([]string, 0, len(series))
		for k := range series {
			lkeys = append(lkeys, k)
		}
		sort.Strings(lkeys)
		for _, lk := range lkeys {
			fmt.Fprintf(&b, "%s{%s} %d\n", name, joinLbl(lk), series[lk])
		}
	}

	gaugeNames := make([]string, 0, len(r.gauges)+len(r.gaugeFuncs))
	gaugeVals := make(map[string]float64, len(r.gauges)+len(r.gaugeFuncs))
	for k, v := range r.gauges {
		gaugeNames = append(gaugeNames, k)
		gaugeVals[k] = v
	}
	for k, fn := range r.gaugeFuncs {
		if _, exists := gaugeVals[k]; !exists {
			gaugeNames = append(gaugeNames, k)
		}
		gaugeVals[k] = fn()
	}
	sort.Strings(gaugeNames)
	for _, name := range gaugeNames {
		fmt.Fprintf(&b, "# TYPE %s gauge\n", name)
		fmt.Fprintf(&b, "%s{%s} %s\n", name, baseLbl, strconv.FormatFloat(gaugeVals[name], 'f', -1, 64))
	}

	histNames := make([]string, 0, len(r.hists))
	for name := range r.hists {
		histNames = append(histNames, name)
	}
	sort.Strings(histNames)
	for _, name := range histNames {
		fmt.Fprintf(&b, "# TYPE %s histogram\n", name)
		hs := r.hists[name]
		lkeys := make([]string, 0, len(hs.byLabel))
		for k := range hs.byLabel {
			lkeys = append(lkeys, k)
		}
		sort.Strings(lkeys)
		for _, lk := range lkeys {
			hv := hs.byLabel[lk]
			lbl := joinLbl(lk)
			for i, bound := range hs.buckets {
				fmt.Fprintf(&b, "%s_bucket{%s,le=%q} %d\n", name, lbl, strconv.FormatFloat(bound, 'f', -1, 64), hv.counts[i])
			}
			fmt.Fprintf(&b, "%s_bucket{%s,le=\"+Inf\"} %d\n", name, lbl, hv.count)
			fmt.Fprintf(&b, "%s_sum{%s} %.3f\n", name, lbl, hv.sum)
			fmt.Fprintf(&b, "%s_count{%s} %d\n", name, lbl, hv.count)
		}
	}

	return b.String()
}

func (r *Registry) PrometheusHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(r.PrometheusText()))
	})
}

// Snapshot returns structured JSON metrics tailored for the coding-agent #/admin dashboard.
func (r *Registry) Snapshot() map[string]any {
	r.mu.RLock()
	defer r.mu.RUnlock()

	countersOut := make(map[string]map[string]uint64, len(r.counters))
	for name, series := range r.counters {
		cp := make(map[string]uint64, len(series))
		for k, v := range series {
			if k == "" {
				cp["default"] = v
			} else {
				cp[k] = v
			}
		}
		countersOut[name] = cp
	}

	gaugesOut := make(map[string]float64, len(r.gauges)+len(r.gaugeFuncs))
	for k, v := range r.gauges {
		gaugesOut[k] = v
	}
	for k, fn := range r.gaugeFuncs {
		gaugesOut[k] = fn()
	}

	histsOut := make(map[string]any, len(r.hists))
	for name, hs := range r.hists {
		seriesOut := make(map[string]any, len(hs.byLabel))
		for k, hv := range hs.byLabel {
			labelKey := k
			if labelKey == "" {
				labelKey = "default"
			}
			avg := 0.0
			if hv.count > 0 {
				avg = hv.sum / float64(hv.count)
			}
			seriesOut[labelKey] = map[string]any{
				"count": hv.count,
				"sumMs": hv.sum,
				"avgMs": avg,
			}
		}
		histsOut[name] = seriesOut
	}

	return map[string]any{
		"ok":         true,
		"service":    r.service,
		"node":       r.node,
		"uptimeSec":  int64(time.Since(r.startedAt).Seconds()),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"counters":   countersOut,
		"gauges":     gaugesOut,
		"histograms": histsOut,
	}
}

// StartOTLPPusher periodically exports OTLP JSON metrics to OTEL_EXPORTER_OTLP_ENDPOINT (/v1/metrics)
// when endpoint is non-empty, allowing zero-agent ingestion into VictoriaMetrics or OTel Collector.
func (r *Registry) StartOTLPPusher(ctx context.Context, endpoint string, interval time.Duration) {
	endpoint = strings.TrimSpace(strings.TrimRight(endpoint, "/"))
	if endpoint == "" {
		return
	}
	if !strings.HasSuffix(endpoint, "/v1/metrics") {
		endpoint += "/v1/metrics"
	}
	if interval <= 0 {
		interval = 15 * time.Second
	}
	client := &http.Client{Timeout: 5 * time.Second}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				r.pushOTLPOnce(ctx, client, endpoint)
			}
		}
	}()
}

func (r *Registry) pushOTLPOnce(ctx context.Context, client *http.Client, url string) {
	nowUnixNano := strconv.FormatInt(time.Now().UnixNano(), 10)
	snap := r.Snapshot()
	gauges, _ := snap["gauges"].(map[string]float64)

	metrics := make([]map[string]any, 0, len(gauges))
	for name, val := range gauges {
		metrics = append(metrics, map[string]any{
			"name": name,
			"gauge": map[string]any{
				"dataPoints": []map[string]any{{
					"timeUnixNano": nowUnixNano,
					"asDouble":     val,
				}},
			},
		})
	}
	payload := map[string]any{
		"resourceMetrics": []map[string]any{{
			"resource": map[string]any{
				"attributes": []map[string]any{
					{"key": "service.name", "value": map[string]any{"stringValue": r.service}},
					{"key": "host.name", "value": map[string]any{"stringValue": r.node}},
				},
			},
			"scopeMetrics": []map[string]any{{
				"scope":   map[string]any{"name": "coding-dance/otel"},
				"metrics": metrics,
			}},
		}},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err == nil && resp != nil {
		_ = resp.Body.Close()
	}
}
