import { describe, it, expect, vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ultraigdl } from "../../src/index.js";
import * as clientModule from "../../src/network/client.js";

describe("stress: high concurrency", () => {
  afterEach(() => vi.restoreAllMocks());

  it("processes 500 parallel requests with semaphore", async () => {
    const html = await readFile(
      join(process.cwd(), "tests/fixtures/sample-post.html"),
      "utf-8"
    );
    vi.spyOn(clientModule.HttpClient.prototype, "fetch").mockImplementation(
      async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        return { body: html, statusCode: 200, headers: {} };
      }
    );

    const ig = new ultraigdl({ cache: true, maxConcurrency: 200 });
    const count = 500;
    const urls = Array.from(
      { length: count },
      (_, i) => `https://www.instagram.com/p/STRESS${i % 50}/`
    );

    const start = Date.now();
    const results = await Promise.all(urls.map((u) => ig.download(u)));
    const elapsed = Date.now() - start;

    const success = results.filter((r) => r.code === 200).length;
    expect(success).toBe(count);
    console.log(`Stress: ${count} requests in ${elapsed}ms`);
    expect(elapsed).toBeLessThan(120_000);
  }, 120_000);
});