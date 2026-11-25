package builder

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/conc"
)

type ArtifactRef struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
	Bytes  int    `json:"bytes"`
}

type R2Manifest struct {
	Version     int                    `json:"version"`
	GeneratedAt string                 `json:"generatedAt"`
	TotalBytes  int64                  `json:"totalBytes"`
	Problems    map[string]ArtifactRef `json:"problems"`
	Practice    map[string]ArtifactRef `json:"practice"`
	Topics      map[string]ArtifactRef `json:"topics"`
	TopicsIndex *ArtifactRef           `json:"topicsIndex,omitempty"`
}

// BundleR2Artifacts builds content-addressed immutable JSON blobs under <outDir>/v1/
// along with <outDir>/v1/manifest.json, eliminating the need to commit derived JSON in Git.
func BundleR2Artifacts(ctx context.Context, repoRoot, outDir string, workers int) (*R2Manifest, error) {
	if workers <= 0 {
		workers = runtime.NumCPU()
	}
	v1Dir := filepath.Join(outDir, "v1")
	for _, sub := range []string{"problems", "practice", "topics"} {
		if err := os.MkdirAll(filepath.Join(v1Dir, sub), 0o755); err != nil {
			return nil, err
		}
	}

	manifest := &R2Manifest{
		Version:     1,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Problems:    make(map[string]ArtifactRef),
		Practice:    make(map[string]ArtifactRef),
		Topics:      make(map[string]ArtifactRef),
	}
	var mu sync.Mutex
	var totalBytes atomic.Int64

	compactAndWrite := func(srcPath, relCategory, keyName string) (ArtifactRef, error) {
		raw, err := os.ReadFile(srcPath)
		if err != nil {
			return ArtifactRef{}, err
		}
		var compacted bytes.Buffer
		if err := json.Compact(&compacted, raw); err != nil {
			compacted.Reset()
			compacted.Write(raw)
		}
		data := compacted.Bytes()
		sum := sha256.Sum256(data)
		shaHex := hex.EncodeToString(sum[:])
		relPath := fmt.Sprintf("v1/%s/%s.%s.json", relCategory, keyName, shaHex[:12])
		dstPath := filepath.Join(outDir, filepath.FromSlash(relPath))
		if err := os.WriteFile(dstPath, data, 0o644); err != nil {
			return ArtifactRef{}, err
		}
		totalBytes.Add(int64(len(data)))
		return ArtifactRef{Path: relPath, SHA256: shaHex, Bytes: len(data)}, nil
	}

	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)

	illDataDir := filepath.Join(repoRoot, "tools", "illustrations", "data")
	pracDataDir := filepath.Join(repoRoot, "tools", "practice", "data")

	probEntries, err := os.ReadDir(illDataDir)
	if err != nil {
		return nil, err
	}
	for _, e := range probEntries {
		if e.IsDir() || len(e.Name()) != 9 || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		fname := e.Name()
		pad4 := strings.TrimSuffix(fname, ".json")
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			pRef, err := compactAndWrite(filepath.Join(illDataDir, fname), "problems", pad4)
			if err != nil {
				return err
			}
			prRef, err := compactAndWrite(filepath.Join(pracDataDir, fname), "practice", pad4)
			if err != nil {
				return err
			}
			mu.Lock()
			manifest.Problems[pad4] = pRef
			manifest.Practice[pad4] = prRef
			mu.Unlock()
			return nil
		})
	}

	topicDataDir := filepath.Join(illDataDir, "topics")
	if tEntries, err := os.ReadDir(topicDataDir); err == nil {
		for _, e := range tEntries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			fname := e.Name()
			slug := strings.TrimSuffix(fname, ".json")
			g.Go(func() error {
				if gCtx.Err() != nil {
					return gCtx.Err()
				}
				ref, err := compactAndWrite(filepath.Join(topicDataDir, fname), "topics", slug)
				if err != nil {
					return err
				}
				mu.Lock()
				if slug == "index" {
					manifest.TopicsIndex = &ref
				} else {
					manifest.Topics[slug] = ref
				}
				mu.Unlock()
				return nil
			})
		}
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}
	manifest.TotalBytes = totalBytes.Load()

	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(v1Dir, "manifest.json"), append(manifestBytes, '\n'), 0o644); err != nil {
		return nil, err
	}
	return manifest, nil
}

// R2Uploader uploads content-addressed bundles to Cloudflare R2 / S3 using AWS Signature Version 4.
type R2Uploader struct {
	Endpoint        string // e.g. https://<accountid>.r2.cloudflarestorage.com
	Bucket          string
	Region          string // default "auto"
	Prefix          string
	AccessKeyID     string
	SecretAccessKey string
	HTTPClient      *http.Client
}

type UploadSummary struct {
	Uploaded int64
	Skipped  int64
}

func (u *R2Uploader) SyncDir(ctx context.Context, outDir string, workers int) (UploadSummary, error) {
	if workers <= 0 {
		workers = 8
	}
	if u.Region == "" {
		u.Region = "auto"
	}
	if u.HTTPClient == nil {
		u.HTTPClient = &http.Client{Timeout: 30 * time.Second}
	}

	var relFiles []string
	err := filepath.WalkDir(outDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, err := filepath.Rel(outDir, path)
		if err != nil {
			return err
		}
		relFiles = append(relFiles, filepath.ToSlash(rel))
		return nil
	})
	if err != nil {
		return UploadSummary{}, err
	}
	sort.Strings(relFiles)

	var uploaded, skipped atomic.Int64
	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)

	// Upload immutable blobs first, manifest.json last!
	var manifestRel string
	for _, rel := range relFiles {
		if strings.HasSuffix(rel, "/manifest.json") || rel == "manifest.json" {
			manifestRel = rel
			continue
		}
		rel := rel
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			exists, err := u.headObject(gCtx, rel)
			if err == nil && exists {
				skipped.Add(1)
				return nil
			}
			body, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash(rel)))
			if err != nil {
				return err
			}
			if err := u.putObject(gCtx, rel, body, "public, max-age=31536000, immutable"); err != nil {
				return err
			}
			uploaded.Add(1)
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return UploadSummary{}, err
	}
	if manifestRel != "" {
		body, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash(manifestRel)))
		if err != nil {
			return UploadSummary{}, err
		}
		if err := u.putObject(ctx, manifestRel, body, "public, max-age=60"); err != nil {
			return UploadSummary{}, err
		}
		uploaded.Add(1)
	}
	return UploadSummary{Uploaded: uploaded.Load(), Skipped: skipped.Load()}, nil
}

func (u *R2Uploader) objectURL(relKey string) string {
	key := strings.TrimLeft(relKey, "/")
	if p := strings.Trim(u.Prefix, "/"); p != "" {
		key = p + "/" + key
	}
	return strings.TrimRight(u.Endpoint, "/") + "/" + u.Bucket + "/" + key
}

func (u *R2Uploader) headObject(ctx context.Context, relKey string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, u.objectURL(relKey), nil)
	if err != nil {
		return false, err
	}
	u.signRequestV4(req, nil, time.Now().UTC())
	resp, err := u.HTTPClient.Do(req)
	if err != nil {
		return false, err
	}
	_ = resp.Body.Close()
	return resp.StatusCode == http.StatusOK, nil
}

func (u *R2Uploader) putObject(ctx context.Context, relKey string, body []byte, cacheControl string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, u.objectURL(relKey), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Cache-Control", cacheControl)
	req.ContentLength = int64(len(body))
	u.signRequestV4(req, body, time.Now().UTC())
	resp, err := u.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("PUT %s returned HTTP %d", relKey, resp.StatusCode)
	}
	return nil
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

func sha256HexBytes(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}

func (u *R2Uploader) signRequestV4(req *http.Request, body []byte, now time.Time) {
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	payloadHash := sha256HexBytes(body)

	req.Header.Set("Host", req.URL.Host)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)

	escapedPath := req.URL.EscapedPath()
	if escapedPath == "" {
		escapedPath = "/"
	}
	canonicalQuery := ""
	if req.URL.RawQuery != "" {
		vals, _ := url.ParseQuery(req.URL.RawQuery)
		canonicalQuery = vals.Encode()
	}

	signedHeaders := "host;x-amz-content-sha256;x-amz-date"
	canonicalHeaders := fmt.Sprintf("host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n", req.URL.Host, payloadHash, amzDate)
	canonicalReq := strings.Join([]string{
		req.Method,
		escapedPath,
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	scope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, u.Region)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256HexBytes([]byte(canonicalReq)),
	}, "\n")

	kDate := hmacSHA256([]byte("AWS4"+u.SecretAccessKey), dateStamp)
	kRegion := hmacSHA256(kDate, u.Region)
	kService := hmacSHA256(kRegion, "s3")
	kSigning := hmacSHA256(kService, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))

	req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		u.AccessKeyID, scope, signedHeaders, signature))
}
