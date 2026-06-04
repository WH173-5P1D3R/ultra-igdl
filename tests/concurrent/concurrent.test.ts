import { describe, it, expect, vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ultraigdl } from "../../src/index.js";
import * as clientModule from "../../src/network/client.js";

describe("concurrent requests", () => {
  afterEach(() => vi.restoreAllMocks());

  it("handles 100 concurrent downloads", async () => {
    const html = await readFile(
      join(process.cwd(), "tests/fixtures/sample-post.html"),
      "utf-8"
    );
    vi.spyOn(clientModule.HttpClient.prototype, "fetch").mockResolvedValue({
      body: html,
      statusCode: 200,
      headers: {},
    });

    const ig = new ultraigdl({ cache: false, maxConcurrency: 100 });
    const urls = Array.from(
      { length: 100 },
      (_, i) => `https://www.instagram.com/p/CONC${i}/`
    );

    const start = Date.now();
    const results = await Promise.all(urls.map((u) => ig.download(u)));
    const elapsed = Date.now() - start;

    expect(results.every((r) => r.code === 200)).toBe(true);
    expect(elapsed).toBeLessThan(30_000);
  });

  it("deduplicates in-flight identical URLs", async () => {
    const html = await readFile(
      join(process.cwd(), "tests/fixtures/sample-reel.html"),
      "utf-8"
    );
    const fetchSpy = vi
      .spyOn(clientModule.HttpClient.prototype, "fetch")
      .mockResolvedValue({ body: html, statusCode: 200, headers: {} });

    const ig = new ultraigdl({ cache: false });
    const url = "https://www.instagram.com/reel/DEDUPE/";
    await Promise.all([ig.download(url), ig.download(url), ig.download(url)]);

    // One page fetch + one captioned embed (deduped across parallel callers).
    expect(fetchSpy.mock.calls.length).toBe(2);
  });
});