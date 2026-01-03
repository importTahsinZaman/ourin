import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    exclude: ["node_modules"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ourin/shared": path.resolve(__dirname, "../packages/shared/src"),
      "convex/_generated": path.resolve(__dirname, "../web/convex/_generated"),
    },
  },
});
