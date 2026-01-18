import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "build"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/tools/**/*.ts"],
      exclude: ["app/tools/**/*.txt"],
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
} as any);
