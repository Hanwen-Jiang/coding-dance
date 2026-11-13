/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出到 out/，由 Cloudflare Pages 托管；数据在运行时由 functions/ 里的 Pages Functions 从 GitHub 读取
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
