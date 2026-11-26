package builder

import (
	"context"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestParseCodeAndMulberry32Parity(t *testing.T) {
	py := "\n\nclass Solution:\n    def f(self):\n        x = 1 #@init\n        return x #@ret,done  \n\n"
	p := ParseCode(py)
	if strings.Contains(p.Code, "#@") {
		t.Fatalf("expected marks stripped, got:\n%s", p.Code)
	}
	if len(p.Marks["init"]) != 1 || p.Marks["init"][0] != 3 {
		t.Fatalf("unexpected init mark: %#v", p.Marks)
	}
	if len(p.Marks["ret"]) != 1 || p.Marks["ret"][0] != 4 || p.Marks["done"][0] != 4 {
		t.Fatalf("unexpected multi-tag marks: %#v", p.Marks)
	}

	goSrc := "func f() int {\n\tx := 1 //@init\n\treturn x //@ret,done\n}"
	if _, bad := CheckMarkParity(p.Marks, "go", goSrc); bad != "" {
		t.Fatalf("expected parity match, got %s", bad)
	}
	badGo := "func f() int {\n\tx := 1 //@init\n\treturn x //@ret\n}"
	if _, bad := CheckMarkParity(p.Marks, "go", badGo); bad == "" {
		t.Fatal("expected mark mismatch error when 'done' tag missing")
	}

	// Mulberry32(7936) first value (1 * 7919 + 17 = 7936)
	rng := Mulberry32(7936)
	v0 := rng()
	if v0 <= 0 || v0 >= 1 || math.IsNaN(v0) {
		t.Fatalf("invalid mulberry32 output: %v", v0)
	}
}

func TestVerifyRealWorkspaceBundleAndR2Upload(t *testing.T) {
	repoRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	_, err1 := os.Stat(filepath.Join(repoRoot, "tools", "illustrations", "data", "0001.json"))
	_, err2 := os.Stat(filepath.Join(repoRoot, "tools", "practice", "data", "0001.json"))
	if err1 != nil || err2 != nil {
		if err := BuildWorkspace(context.Background(), repoRoot, BuildOptions{Workers: 8, Quick: true}); err != nil {
			t.Fatalf("BuildWorkspace failed: %v", err)
		}
	}
	rep, err := VerifyWorkspace(context.Background(), repoRoot, 8)
	if err != nil {
		t.Fatalf("VerifyWorkspace on real repo failed: %v", err)
	}
	if rep.ProblemsChecked != 100 || rep.TopicsChecked != 22 || rep.CodeFilesParsed < 500 {
		t.Fatalf("unexpected workspace verification counts: %+v", rep)
	}
	if err := JudgeWorkspace(context.Background(), repoRoot, JudgeOptions{
		Langs:   []string{"python", "go", "javascript"},
		Targets: []string{"1"},
		Workers: 4,
	}); err != nil {
		t.Fatalf("JudgeWorkspace(1, python/go/js) failed: %v", err)
	}

	contractsDir := t.TempDir()
	exported, err := ExportContracts(context.Background(), repoRoot, contractsDir, 8)
	if err != nil || exported != 100 {
		t.Fatalf("ExportContracts failed: n=%d err=%v", exported, err)
	}

	bundleDir := t.TempDir()
	manifest, err := BundleR2Artifacts(context.Background(), repoRoot, bundleDir, 8)
	if err != nil {
		t.Fatalf("BundleR2Artifacts failed: %v", err)
	}
	if len(manifest.Problems) != 100 || len(manifest.Practice) != 100 || len(manifest.Topics) != 22 || manifest.TopicsIndex == nil {
		t.Fatalf("incomplete manifest: problems=%d practice=%d topics=%d", len(manifest.Problems), len(manifest.Practice), len(manifest.Topics))
	}

	// Mock S3/R2 server verifying SigV4 headers & incremental skip on second sync
	var mu sync.Mutex
	objects := make(map[string][]byte)
	r2Srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 ") {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodHead:
			if _, ok := objects[r.URL.Path]; ok {
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusNotFound)
			}
		case http.MethodPut:
			objects[r.URL.Path] = []byte("ok")
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	defer r2Srv.Close()

	up := &R2Uploader{
		Endpoint:        r2Srv.URL,
		Bucket:          "coding-dance-assets",
		AccessKeyID:     "AKIA_TEST",
		SecretAccessKey: "SECRET_TEST",
	}
	sum1, err := up.SyncDir(context.Background(), bundleDir, 8)
	if err != nil || sum1.Uploaded == 0 || sum1.Skipped != 0 {
		t.Fatalf("first SyncDir failed: %+v err=%v", sum1, err)
	}
	// Second sync: every content-addressed blob is skipped, only manifest.json is refreshed!
	sum2, err := up.SyncDir(context.Background(), bundleDir, 8)
	if err != nil || sum2.Uploaded != 1 || sum2.Skipped != sum1.Uploaded-1 {
		t.Fatalf("second incremental SyncDir mismatch: sum1=%+v sum2=%+v err=%v", sum1, sum2, err)
	}
}
