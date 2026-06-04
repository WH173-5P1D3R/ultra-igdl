import { describe, it, expect, vi, afterEach } from "vitest";
import { DownloaderCore } from "../../src/core/downloader.js";
import * as clientModule from "../../src/network/client.js";

describe("fast response budget", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns cached response within budget", async () => {
    const core = new DownloaderCore({ fastMode: true, cache: true });
    const url = "https://www.instagram.com/p/FASTCACHE1/";
    core["cache"].set("https://www.instagram.com/p/FASTCACHE1/", {
      code: 200,
      meta: { extractor: "ultra-igdl", version: "1.0.0" },
      media: [{ type: "image", url: "https://cdninstagram.com/x.jpg" }],
      caption: "",
      username: "u",
    });

    const start = Date.now();
    const hit = await core.download(url);
    expect(Date.now() - start).toBeLessThan(50);
    expect(hit.code).toBe(200);
  });

  it("returns 503 when budget exceeded then serves cache on retry", async () => {
    let resolveFetch!: () => void;
    const slow = new Promise<void>((r) => {
      resolveFetch = r;
    });

    vi.spyOn(clientModule.HttpClient.prototype, "fetch").mockImplementation(async () => {
      await slow;
      return {
        body: await import("node:fs/promises").then((fs) =>
          fs.readFile("tests/fixtures/sample-post.html", "utf-8")
        ),
        statusCode: 200,
        headers: {},
      };
    });

    const core = new DownloaderCore({ responseBudgetMs: 500, cache: true, retries: 0 });
    const url = "https://www.instagram.com/p/SLOWBUDGET1/";

    const t0 = Date.now();
    const first = await core.download(url);
    expect(Date.now() - t0).toBeLessThan(600);
    expect(first.code).toBe(503);
    expect((first as { retryAfterMs?: number }).retryAfterMs).toBeGreaterThan(0);

    resolveFetch();
    await vi.waitFor(
      async () => {
        const second = await core.download(url);
        expect(second.code).toBe(200);
      },
      { timeout: 5_000 }
    );
  });
});