package progress

import (
	"strings"
	"testing"
	"time"
)

func TestCodeKeyBlobSHAAndMonotonicStatus(t *testing.T) {
	c1 := "# Definition for singly-linked list\nclass Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]\n"
	c2 := "class Solution:\r\n  def twoSum(self,nums,target):\r\n    return [0,1]"
	if CodeKey(c1) != CodeKey(c2) {
		t.Fatalf("expected identical CodeKey, got %q vs %q", CodeKey(c1), CodeKey(c2))
	}

	// Known git hash-object output for "hello\n": ce013625030ba8dba906f756967f9e9ca394464a
	if got := GitBlobSHA("hello\n"); got != "ce013625030ba8dba906f756967f9e9ca394464a" {
		t.Fatalf("GitBlobSHA mismatch: got %s", got)
	}

	// Monotonic transitions
	s1 := NextStatus(nil, "答案错误", "2026-11-26")
	if s1 == nil || s1.Status != "尝试过" {
		t.Fatalf("expected 尝试过, got %+v", s1)
	}
	if s2 := NextStatus(s1, "超时", "2026-11-26"); s2 != nil {
		t.Fatalf("expected nil when already 尝试过 and failed again, got %+v", s2)
	}
	s3 := NextStatus(s1, "通过", "2026-11-26")
	if s3 == nil || s3.Status != "已通过" {
		t.Fatalf("expected upgrade to 已通过, got %+v", s3)
	}
	if s4 := NextStatus(s3, "答案错误", "2026-11-27"); s4 != nil {
		t.Fatalf("expected 已通过 never to downgrade, got %+v", s4)
	}
}

func TestPlanPracticeSaveDeduplicationAndNumbering(t *testing.T) {
	prob := ProblemMeta{ID: 1, Name: "两数之和"}
	now := time.Date(2026, 11, 26, 2, 0, 0, 0, time.FixedZone("CST", 8*3600))

	// Quick scope cannot claim "通过"
	if _, err := ValidatePracticeSave([]byte(`{"kind":"run","id":1,"lang":"go","mode":"leetcode","code":"package main","result":"通过","passed":3,"total":3,"scope":"quick"}`)); err == nil {
		t.Fatal("expected quick scope with 通过 to fail validation")
	}

	raw := `{"kind":"run","id":1,"lang":"go","mode":"leetcode","code":"func twoSum(nums []int, t int) []int { return []int{0,1} }","result":"通过","passed":15,"total":15,"duration":12}`
	save, err := ValidatePracticeSave([]byte(raw))
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}

	plan, err := PlanPracticeSave(*save, PlanContext{
		Problem:       prob,
		ExistingPaths: []string{"attempts/0001.两数之和/2026-11-26.1.答案错误.md", "solutions/go/0001.两数之和.go"},
		ExistingSolutions: map[string]string{
			"solutions/go/0001.两数之和.go": "func twoSum(nums []int, t int) []int { return nil }",
		},
		Now: now,
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Attempt != "attempts/0001.两数之和/2026-11-26.2.通过.md" {
		t.Fatalf("unexpected attempt path: %s", plan.Attempt)
	}
	if plan.Solution != "solutions/go/0001.两数之和.2.go" {
		t.Fatalf("expected .2 solution numbering, got %s", plan.Solution)
	}
	if plan.Status != "已通过" || len(plan.Files) != 3 {
		t.Fatalf("expected 3 files (attempt + solution + progress.json), got %+v", plan)
	}
	if !strings.Contains(plan.Files[0].Content, "source: practice") {
		t.Fatalf("attempt markdown missing frontmatter:\n%s", plan.Files[0].Content)
	}
}
