import { describe, it, expect } from "vitest";
import { extractMediaPkFromHtml } from "../../src/utils/media-id.js";

describe("extractMediaPkFromHtml", () => {
  it("decodes ig_cache_key from page HTML", () => {
    const html = `<meta property="og:image" content="https://cdninstagram.com/x.jpg?ig_cache_key=MzkwNDgxMzc5NzE0ODQ1MTQzNA%3D%3D" />`;
    expect(extractMediaPkFromHtml(html)).toBe("3904813797148451434");
  });
});