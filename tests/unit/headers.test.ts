import { describe, it, expect } from "vitest";
import { buildHeaders, buildApiHeaders, rotateIndex } from "../../src/network/headers.js";

describe("headers", () => {
  it("builds document headers", () => {
    const headers = buildHeaders("https://www.instagram.com/p/abc/");
    expect(headers["User-Agent"]).toContain("Mozilla");
    expect(headers.Referer).toBe("https://www.instagram.com/");
  });

  it("rotates user agents", () => {
    const h1 = buildHeaders("https://www.instagram.com/", true);
    const h2 = buildHeaders("https://www.instagram.com/", true);
    expect(rotateIndex(10)).toBeGreaterThanOrEqual(0);
    expect(h1["User-Agent"]).toBeDefined();
    expect(h2["User-Agent"]).toBeDefined();
  });

  it("builds API headers", () => {
    const headers = buildApiHeaders();
    expect(headers["X-IG-App-ID"]).toBe("936619743392459");
  });
});