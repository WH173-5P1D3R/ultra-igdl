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
        lines: 91,
        functions: 95,
        branches: 78,
        statements: 91,
      },
    },
    testTimeout: 30000,
  },
});