import { describe, it, expect } from "vitest";
import { runExtractor, resolveFetchUrl } from "../../src/core/extractor.js";
import { parseInstagramUrl } from "../../src/utils/urls.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("extractor core", () => {
  it("resolveFetchUrl for story without id", () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/user/");
    expect(resolveFetchUrl(parsed)).toContain("/stories/user/");
  });

  it("runExtractor handles unknown as post", async () => {
    const html = await readFile(
      join(process.cwd(), "tests/fixtures/sample-post.html"),
      "utf-8"
    );
    const parsed = parseInstagramUrl("https://www.instagram.com/unknown/path/");
    const result = await runExtractor({
      html,
      url: parsed.normalized,
      parsed: { ...parsed, type: "unknown" },
    });
    expect(result?.media.length).toBeGreaterThan(0);
  });
});