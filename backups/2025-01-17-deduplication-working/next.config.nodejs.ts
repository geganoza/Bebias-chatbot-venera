// next.config.nodejs.ts - for Node.js deployment
import type { NextConfig } from "next";

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;