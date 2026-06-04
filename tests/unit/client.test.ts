import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpClient } from "../../src/network/client.js";
import * as requestModule from "../../src/network/request.js";

describe("HttpClient", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches HTML successfully", async () => {
    vi.spyOn(requestModule, "request").mockResolvedValue({
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: { text: async () => "<html>ok</html>" },
    } as never);

    const client = new HttpClient({ timeoutMs: 5000, retries: 0 });
    const result = await client.fetch("https://www.instagram.com/p/TEST/");
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain("ok");
  });

  it("retries on 503", async () => {
    let calls = 0;
    vi.spyOn(requestModule, "request").mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        return {
          statusCode: 503,
          headers: {},
          body: { text: async () => "" },
        } as never;
      }
      return {
        statusCode: 200,
        headers: {},
        body: { text: async () => "<html/>" },
      } as never;
    });

    const client = new HttpClient({ retries: 2, timeoutMs: 5000 });
    const result = await client.fetch("https://www.instagram.com/p/RETRY/", false);
    expect(result.statusCode).toBe(200);
    expect(calls).toBe(2);
  });

  it("deduplicates in-flight requests", async () => {
    vi.spyOn(requestModule, "request").mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: { text: async () => "<html/>" },
    } as never);

    const client = new HttpClient({ retries: 0 });
    const url = "https://www.instagram.com/p/DEDUPE_CLIENT/";
    await Promise.all([client.fetch(url), client.fetch(url)]);
    expect(requestModule.request).toHaveBeenCalledTimes(1);
  });

  it("throws on 429 status", async () => {
    vi.spyOn(requestModule, "request").mockResolvedValue({
      statusCode: 429,
      headers: {},
      body: { text: async () => "" },
    } as never);

    const client = new HttpClient({ retries: 0 });
    await expect(
      client.fetch("https://www.instagram.com/p/RL429/", false)
    ).rejects.toMatchObject({ message: "Rate limited", statusCode: 429 });
  });
});