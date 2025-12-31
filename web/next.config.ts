import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ourin/core"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
