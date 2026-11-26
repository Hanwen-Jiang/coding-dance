package conc

import (
	"context"
	"sync"
)

// Group coordinates a collection of goroutines working on subtasks of a common task,
// with optional bounded concurrency and first-error cancellation.
type Group struct {
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	sem     chan struct{}
	errOnce sync.Once
	err     error
}

// WithContext returns a new Group and an associated Context derived from ctx.
// The derived Context is canceled the first time a function passed to Go returns
// a non-nil error or the first time Wait returns, whichever occurs first.
func WithContext(ctx context.Context) (*Group, context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	return &Group{cancel: cancel}, ctx
}

// SetLimit limits the number of active goroutines in this group to at most n.
// A negative value indicates no limit. Must not be modified while goroutines are active.
func (g *Group) SetLimit(n int) {
	if n < 0 {
		g.sem = nil
		return
	}
	if n == 0 {
		n = 1
	}
	g.sem = make(chan struct{}, n)
}

func (g *Group) done() {
	if g.sem != nil {
		<-g.sem
	}
	g.wg.Done()
}

// Go calls the given function in a new goroutine.
// If a limit is configured, Go blocks until a worker slot is available.
func (g *Group) Go(f func() error) {
	if g.sem != nil {
		g.sem <- struct{}{}
	}
	g.wg.Add(1)
	go func() {
		defer g.done()
		if err := f(); err != nil {
			g.errOnce.Do(func() {
				g.err = err
				if g.cancel != nil {
					g.cancel()
				}
			})
		}
	}()
}

// Wait blocks until all function calls from Go have returned, then returns the first non-nil error.
func (g *Group) Wait() error {
	g.wg.Wait()
	if g.cancel != nil {
		g.cancel()
	}
	return g.err
}
