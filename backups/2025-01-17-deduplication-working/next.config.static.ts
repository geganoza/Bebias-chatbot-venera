// next.config.static.ts - for static export
import type { NextConfig } from "next";

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};
export default nextConfig;