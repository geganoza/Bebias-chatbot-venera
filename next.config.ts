// next.config.ts - for Vercel deployment
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: eslint config moved to eslint.config.js in Next.js 16
  images: {
    unoptimized: true,
  },
};
export default nextConfig;
