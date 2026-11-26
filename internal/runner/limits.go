package runner

import (
	"context"
	"sync"
	"time"
)

type userBucket struct {
	times   []time.Time
	running int
}

// UserLimits enforces per-user concurrency (at most 1 running job) and sliding-window per-minute limits.
type UserLimits struct {
	perMinute int
	mu        sync.Mutex
	users     map[string]*userBucket
}

func NewUserLimits(perMinute int) *UserLimits {
	if perMinute <= 0 {
		perMinute = 20
	}
	return &UserLimits{
		perMinute: perMinute,
		users:     make(map[string]*userBucket),
	}
}

func (l *UserLimits) Admit(user string, now time.Time) string {
	l.mu.Lock()
	defer l.mu.Unlock()

	u := l.users[user]
	if u == nil {
		u = &userBucket{}
		l.users[user] = u
	}
	kept := u.times[:0]
	for _, t := range u.times {
		if now.Sub(t) < time.Minute {
			kept = append(kept, t)
		}
	}
	u.times = kept
	if u.running >= 1 {
		return "上一次运行还没结束"
	}
	if len(u.times) >= l.perMinute {
		return "运行得太频繁了，等一分钟再试"
	}
	u.times = append(u.times, now)
	u.running++
	return ""
}

func (l *UserLimits) Done(user string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if u := l.users[user]; u != nil && u.running > 0 {
		u.running--
	}
	if len(l.users) > 10000 {
		now := time.Now()
		for k, v := range l.users {
			if v.running == 0 {
				active := false
				for _, t := range v.times {
					if now.Sub(t) < time.Minute {
						active = true
						break
					}
				}
				if !active {
					delete(l.users, k)
				}
			}
		}
	}
}

// Slots bounds concurrent executions to maxSlots and waiting callers to queueMax in FIFO order.
type Slots struct {
	max      int
	queueMax int
	mu       sync.Mutex
	busy     int
	waiting  []chan struct{}
}

func NewSlots(slots, queue int) *Slots {
	if slots <= 0 {
		slots = 2
	}
	if queue < 0 {
		queue = 0
	}
	return &Slots{max: slots, queueMax: queue}
}

func (s *Slots) Acquire(ctx context.Context) (release func(), admitted bool, err error) {
	s.mu.Lock()
	if s.busy < s.max {
		s.busy++
		s.mu.Unlock()
		return s.release, true, nil
	}
	if len(s.waiting) >= s.queueMax {
		s.mu.Unlock()
		return nil, false, nil
	}
	ch := make(chan struct{})
	s.waiting = append(s.waiting, ch)
	s.mu.Unlock()

	select {
	case <-ch:
		return s.release, true, nil
	case <-ctx.Done():
		s.removeWaiter(ch)
		return nil, true, ctx.Err()
	}
}

func (s *Slots) removeWaiter(ch chan struct{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, w := range s.waiting {
		if w == ch {
			s.waiting = append(s.waiting[:i], s.waiting[i+1:]...)
			return
		}
	}
	// Already woken up between select branches; hand slot to next waiter or decrement busy.
	select {
	case <-ch:
		s.releaseLocked()
	default:
	}
}

func (s *Slots) release() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.releaseLocked()
}

func (s *Slots) releaseLocked() {
	if len(s.waiting) > 0 {
		next := s.waiting[0]
		s.waiting = s.waiting[1:]
		close(next)
		return
	}
	if s.busy > 0 {
		s.busy--
	}
}

func (s *Slots) Counts() (busy, queued int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.busy, len(s.waiting)
}
