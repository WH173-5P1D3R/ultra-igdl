import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli/**",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 85,
        branches: 70,
        statements: 70,
      },
    },
    testTimeout: 30000,
  },
});