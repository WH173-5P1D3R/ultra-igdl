import { describe, it, expect, vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runExtractor } from "../../src/core/extractor.js";
import { parseInstagramUrl } from "../../src/utils/urls.js";

describe("extractor tv type", () => {
  afterEach(() => vi.restoreAllMocks());

  it("handles tv URLs like reels", async () => {
    const html = await readFile(
      join(process.cwd(), "tests/fixtures/sample-reel.html"),
      "utf-8"
    );
    const parsed = parseInstagramUrl("https://www.instagram.com/tv/TV123/");
    const result = await runExtractor({ html, url: parsed.normalized, parsed });
    expect(result?.media.some((m) => m.type === "video")).toBe(true);
  });
});