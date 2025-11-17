// next.config.ts - for Vercel deployment
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // output: 'export', // disabled to allow dynamic app routes (runtime APIs)
  // trailingSlash: true, // disabled - causes issues with API routes
  images: {
    unoptimized: true,
  },
};
export default nextConfig;
