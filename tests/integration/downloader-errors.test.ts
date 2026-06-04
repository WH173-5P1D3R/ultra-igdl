import { describe, it, expect, vi, afterEach } from "vitest";
import { ultraigdl } from "../../src/index.js";
import * as clientModule from "../../src/network/client.js";

describe("downloader error paths", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 400 for invalid URL", async () => {
    const ig = new ultraigdl();
    const result = await ig.download("https://example.com/not-ig");
    expect(result.code).toBe(400);
  });

  it("returns 404 on HTTP 404", async () => {
    vi.spyOn(clientModule.HttpClient.prototype, "fetch").mockResolvedValue({
      body: "",
      statusCode: 404,
      headers: {},
    });
    const ig = new ultraigdl({ cache: false });
    const result = await ig.download("https://www.instagram.com/p/404/");
    expect(result.code).toBe(404);
  });

  it("returns error response from media() on failure", async () => {
    vi.spyOn(clientModule.HttpClient.prototype, "fetch").mockResolvedValue({
      body: "<html></html>",
      statusCode: 200,
      headers: {},
    });
    const ig = new ultraigdl({ cache: false });
    const result = await ig.media("https://www.instagram.com/p/EMPTY/");
    expect("message" in result).toBe(true);
  });
});