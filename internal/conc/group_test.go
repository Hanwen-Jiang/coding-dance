package conc

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestGroupLimitAndCancel(t *testing.T) {
	g, ctx := WithContext(context.Background())
	g.SetLimit(3)

	var active, peak atomic.Int32
	for range 12 {
		g.Go(func() error {
			cur := active.Add(1)
			for {
				old := peak.Load()
				if cur <= old || peak.CompareAndSwap(old, cur) {
					break
				}
			}
			time.Sleep(10 * time.Millisecond)
			active.Add(-1)
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p := peak.Load(); p > 3 {
		t.Fatalf("expected peak concurrency <= 3, got %d", p)
	}
	select {
	case <-ctx.Done():
	default:
		t.Fatal("expected context canceled after Wait")
	}

	g2, ctx2 := WithContext(context.Background())
	want := errors.New("boom")
	g2.Go(func() error { return want })
	g2.Go(func() error {
		<-ctx2.Done()
		return nil
	})
	if err := g2.Wait(); !errors.Is(err, want) {
		t.Fatalf("expected %v, got %v", want, err)
	}
}
