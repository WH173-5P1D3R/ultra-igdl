import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  htmlIndicatesCarouselPost,
  buildPostContentTags,
} from "../../src/utils/post-carousel-detect.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("post carousel detect", () => {
  it("detects carousel in sample-carousel.html", async () => {
    const html = await readFile(join(fixturesDir, "sample-carousel.html"), "utf8");
    expect(htmlIndicatesCarouselPost(html)).toBe(true);
  });

  it("does not flag single-image fixture as carousel", async () => {
    const html = await readFile(join(fixturesDir, "sample-post.html"), "utf8");
    expect(htmlIndicatesCarouselPost(html)).toBe(false);
  });

  it("buildPostContentTags returns carousel when multiple media", () => {
    expect(buildPostContentTags("post", 3, "", false)).toEqual(["carousel"]);
  });

  it("buildPostContentTags returns partial_carousel without session", async () => {
    const html = await readFile(join(fixturesDir, "sample-carousel.html"), "utf8");
    expect(buildPostContentTags("post", 1, html, false)).toEqual([
      "partial_carousel",
      "session_recommended",
    ]);
  });
});