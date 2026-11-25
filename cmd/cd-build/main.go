package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/builder"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}
	sub := os.Args[1]
	ctx := context.Background()
	t0 := time.Now()

	switch sub {
	case "verify":
		fs := flag.NewFlagSet("verify", flag.ExitOnError)
		root := fs.String("root", ".", "repository root")
		workers := fs.Int("workers", runtime.NumCPU(), "max concurrent goroutines")
		_ = fs.Parse(os.Args[2:])

		rep, err := builder.VerifyWorkspace(ctx, *root, *workers)
		if err != nil {
			fmt.Fprintf(os.Stderr, "✗ 校验失败: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✓ cd-build verify 通过（耗时 %s）：%d 道热题、%d 个基础专题、%d 份多语言源码 //@tag 标记、%d 组判题用例全部一致\n",
			time.Since(t0).Round(time.Millisecond), rep.ProblemsChecked, rep.TopicsChecked, rep.CodeFilesParsed, rep.TotalCases)

	case "export-contracts":
		fs := flag.NewFlagSet("export-contracts", flag.ExitOnError)
		root := fs.String("root", ".", "repository root")
		out := fs.String("out", "contracts/generated", "output directory for declarative JSON contracts")
		workers := fs.Int("workers", runtime.NumCPU(), "max concurrent goroutines")
		_ = fs.Parse(os.Args[2:])

		n, err := builder.ExportContracts(ctx, *root, *out, *workers)
		if err != nil {
			fmt.Fprintf(os.Stderr, "✗ 导出契约失败: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✓ 导出 %d 份声明式题目契约至 %s（耗时 %s）\n", n, *out, time.Since(t0).Round(time.Millisecond))

	case "bundle":
		fs := flag.NewFlagSet("bundle", flag.ExitOnError)
		root := fs.String("root", ".", "repository root")
		out := fs.String("out", "dist/r2", "staging directory for content-addressed R2 artifacts")
		upload := fs.Bool("upload", false, "upload staged content-addressed artifacts to Cloudflare R2")
		workers := fs.Int("workers", runtime.NumCPU(), "max concurrent goroutines")
		_ = fs.Parse(os.Args[2:])

		if _, err := builder.VerifyWorkspace(ctx, *root, *workers); err != nil {
			fmt.Fprintf(os.Stderr, "✗ 打包前校验未通过: %v\n", err)
			os.Exit(1)
		}
		manifest, err := builder.BundleR2Artifacts(ctx, *root, *out, *workers)
		if err != nil {
			fmt.Fprintf(os.Stderr, "✗ 生成 R2 产物包失败: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✓ 生成内容寻址 R2 产物包至 %s/v1/manifest.json（%d 题 + %d 专题，共 %.2f MiB，耗时 %s）\n",
			*out, len(manifest.Problems), len(manifest.Topics), float64(manifest.TotalBytes)/(1024*1024), time.Since(t0).Round(time.Millisecond))

		if *upload {
			up := &builder.R2Uploader{
				Endpoint:        os.Getenv("R2_ENDPOINT"),
				Bucket:          os.Getenv("R2_BUCKET"),
				Region:          os.Getenv("R2_REGION"),
				Prefix:          os.Getenv("R2_PREFIX"),
				AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
				SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
			}
			if up.Endpoint == "" || up.Bucket == "" || up.AccessKeyID == "" || up.SecretAccessKey == "" {
				fmt.Fprintln(os.Stderr, "✗ 开启 --upload 时需设置 R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")
				os.Exit(1)
			}
			sum, err := up.SyncDir(ctx, *out, 8)
			if err != nil {
				fmt.Fprintf(os.Stderr, "✗ 上传 R2 失败: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("✓ R2 增量同步完成：新上传 %d 个对象，跳过已存在 %d 个对象\n", sum.Uploaded, sum.Skipped)
		}

	default:
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "用法: cd-build <verify | export-contracts | bundle> [参数]")
}
