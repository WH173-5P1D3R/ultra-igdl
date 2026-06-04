import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/stress/**/*.test.ts"],
    testTimeout: 120000,
    pool: "threads",
    maxWorkers: 8,
  },
});