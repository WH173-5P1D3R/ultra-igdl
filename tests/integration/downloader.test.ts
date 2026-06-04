import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ultraigdl } from "../../src/index.js";
import * as clientModule from "../../src/network/client.js";

const postHtml = () =>
  readFile(join(process.cwd(), "tests/fixtures/sample-post.html"), "utf-8");

describe("integration: ultraigdl", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(clientModule.HttpClient.prototype, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads post media from mocked HTML", async () => {
    fetchSpy.mockResolvedValue({
      body: await postHtml(),
      statusCode: 200,
      headers: {},
    });

    const ig = new ultraigdl({ cache: false });
    const result = await ig.download("https://www.instagram.com/p/ABC123/");

    expect(result.code).toBe(200);
    if (result.code === 200) {
      expect(result.media.length).toBeGreaterThan(0);
      expect(result.meta.extractor).toBe("ultra-igdl");
      expect(result.meta.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("uses cache on second request", async () => {
    fetchSpy.mockResolvedValue({
      body: await postHtml(),
      statusCode: 200,
      headers: {},
    });

    const ig = new ultraigdl({ cache: true });
    const url = "https://www.instagram.com/p/CACHE1/";
    await ig.download(url);
    const fetchesAfterFirst = fetchSpy.mock.calls.length;
    expect(fetchesAfterFirst).toBeGreaterThanOrEqual(1);
    await ig.download(url);
    expect(fetchSpy.mock.calls.length).toBe(fetchesAfterFirst);
  });

  it("returns 404 when no media", async () => {
    fetchSpy.mockResolvedValue({
      body: "<html><body>empty</body></html>",
      statusCode: 200,
      headers: {},
    });

    const ig = new ultraigdl({ cache: false });
    const result = await ig.download("https://www.instagram.com/p/NONE/");
    expect(result.code).toBe(404);
  });

  it("returns 403 for private pages", async () => {
    const html = await readFile(
      join(process.cwd(), "tests/fixtures/private.html"),
      "utf-8"
    );
    fetchSpy.mockResolvedValue({ body: html, statusCode: 200, headers: {} });

    const ig = new ultraigdl({ cache: false });
    const result = await ig.download("https://www.instagram.com/p/PRIV/");
    expect(result.code).toBe(403);
  });

  it("returns 429 on rate limit", async () => {
    fetchSpy.mockRejectedValue(
      Object.assign(new Error("Rate limited"), { statusCode: 429 })
    );

    const ig = new ultraigdl({ cache: false });
    const result = await ig.download("https://www.instagram.com/reel/RL/");
    expect(result.code).toBe(429);
  });

  it("validates URLs", async () => {
    const ig = new ultraigdl();
    const valid = await ig.validate("https://www.instagram.com/reel/X/");
    expect(valid.valid).toBe(true);
    const invalid = await ig.validate("https://example.com");
    expect(invalid.valid).toBe(false);
  });

  it("batch processes multiple URLs", async () => {
    fetchSpy.mockResolvedValue({
      body: await postHtml(),
      statusCode: 200,
      headers: {},
    });

    const ig = new ultraigdl({ cache: false });
    const results = await ig.batch([
      "https://www.instagram.com/p/A/",
      "https://www.instagram.com/p/B/",
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("health returns status", async () => {
    const ig = new ultraigdl();
    const health = await ig.health();
    expect(health.status).toBe("ok");
    expect(health.version).toBe("1.0.0");
  });

  it("media returns only media array", async () => {
    fetchSpy.mockResolvedValue({
      body: await postHtml(),
      statusCode: 200,
      headers: {},
    });

    const ig = new ultraigdl({ cache: false });
    const media = await ig.media("https://www.instagram.com/p/MEDIA/");
    expect(Array.isArray(media)).toBe(true);
  });
});