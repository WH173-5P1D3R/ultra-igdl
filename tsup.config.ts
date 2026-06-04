import { defineConfig } from "tsup";

const shared = {
  format: ["esm", "cjs"] as const,
  dts: true,
  splitting: false,
  sourcemap: true,
  target: "node18" as const,
  minify: false,
  shims: true,
  outExtension({ format }: { format: string }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    clean: true,
  },
  {
    ...shared,
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["cjs"],
    clean: false,
    banner: { js: "#!/usr/bin/env node" },
    outExtension: () => ({ js: ".cjs" }),
  },
]);