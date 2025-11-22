import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 静的書き出し (Cloudflare Pages 用) */
  output: "export",
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
};

export default nextConfig;
