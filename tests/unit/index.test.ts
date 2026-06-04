import { describe, it, expect, vi, afterEach } from "vitest";
import { ultraigdl } from "../../src/index.js";
import * as clientModule from "../../src/network/client.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("ultraigdl class", () => {
  afterEach(() => vi.restoreAllMocks());

  it("exposes all API methods", async () => {
    const html = await readFile(
      join(process.cwd(), "tests/fixtures/sample-post.html"),
      "utf-8"
    );
    vi.spyOn(clientModule.HttpClient.prototype, "fetch").mockResolvedValue({
      body: html,
      statusCode: 200,
      headers: {},
    });

    const ig = new ultraigdl({ cache: false });
    const dl = await ig.download("https://www.instagram.com/p/IDX/");
    expect(dl.code).toBe(200);

    const info = await ig.info("https://www.instagram.com/p/IDX/");
    expect(info.code).toBe(200);

    const val = await ig.validate("https://www.instagram.com/reel/X/");
    expect(val.valid).toBe(true);

    const media = await ig.media("https://www.instagram.com/p/IDX/");
    expect(Array.isArray(media)).toBe(true);

    const batch = await ig.batch(["https://www.instagram.com/p/IDX/"]);
    expect(batch).toHaveLength(1);

    const health = await ig.health();
    expect(health.status).toBe("ok");

    ig.clearCache();
  });
});