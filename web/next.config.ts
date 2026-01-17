import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ourin/core"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default withWorkflow(nextConfig);
