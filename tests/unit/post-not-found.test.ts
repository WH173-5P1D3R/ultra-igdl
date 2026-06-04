import { describe, it, expect } from "vitest";
import { extractPost } from "../../src/extractors/post.js";
import { parseInstagramUrl } from "../../src/utils/urls.js";

describe("post not found", () => {
  it("returns null when page unavailable", async () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/p/MISSING/");
    const result = await extractPost({
      html: "Sorry, this page isn't available",
      url: parsed.normalized,
      parsed,
    });
    expect(result).toBeNull();
  });
});