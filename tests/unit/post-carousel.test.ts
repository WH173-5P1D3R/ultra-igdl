import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseHtml } from "../../src/core/parser.js";
import { normalizeExtraction } from "../../src/core/normalize.js";
import {
  dedupePostSlides,
  pickPostMedia,
  isCarouselAuxiliaryImage,
  stripCarouselAuxiliaryImages,
} from "../../src/utils/post-carousel.js";
import type { Media } from "../../src/types/index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("post carousel", () => {
  it("dedupePostSlides groups by ig_cache_key", () => {
    const media: Media[] = [
      {
        type: "image",
        url: "https://cdninstagram.com/a.jpg?ig_cache_key=ABC%3D%3D&w=640",
        width: 640,
      },
      {
        type: "image",
        url: "https://cdninstagram.com/a.jpg?ig_cache_key=ABC%3D%3D&w=1080",
        width: 1080,
      },
    ];
    expect(dedupePostSlides(media)).toHaveLength(1);
  });

  it("dedupePostSlides keeps one image per slide id", () => {
    const media: Media[] = [
      { type: "image", url: "https://cdninstagram.com/1234567890123_n.jpg?w=640", width: 640 },
      { type: "image", url: "https://cdninstagram.com/1234567890123_n.jpg?w=1080", width: 1080 },
      { type: "image", url: "https://cdninstagram.com/9876543210987_n.jpg", width: 1080 },
    ];
    const out = dedupePostSlides(media);
    expect(out).toHaveLength(2);
    expect(out[0]!.width).toBe(1080);
  });

  it("drops CAROUSEL_BEST_IMAGE preview (not a real slide)", () => {
    const slide1 =
      "https://instagram.fcjb3-3.fna.fbcdn.net/v/t51.82787-15/708557643_18354964135243124_249633440224830713_n.jpg?ig_cache_key=MzkwODM1MDU2MjMyODE4NTY2Nw%3D%3D&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMzI2NS5zZHIucmVndWxhcl9waG90by5DMyJ9";
    const slide2 =
      "https://instagram.fcjb3-3.fna.fbcdn.net/v/t51.82787-15/710374254_18354964144243124_4600329130490665548_n.jpg?ig_cache_key=MzkwODM1MDU3NDM2NTgzODE2Mg%3D%3D&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMzAyNC5oZHIucmVndWxhcl9waG90by5DMyJ9";
    const preview =
      "https://scontent.cdninstagram.com/v/t51.82787-15/708557643_18354964135243124_249633440224830713_n.jpg?stp=c653.0.1959.1959a_dst-jpg_e35_s640x640_tt6&efg=eyJlZmdfdGFnIjoiQ0FST1VTRUxfSVRFTS5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9";
    expect(isCarouselAuxiliaryImage(preview)).toBe(true);
    expect(isCarouselAuxiliaryImage(slide1)).toBe(false);
    const media: Media[] = [
      { type: "image", url: slide1, width: 3265, height: 3555 },
      { type: "image", url: slide2, width: 3024, height: 3293 },
      { type: "image", url: preview, width: 1959, height: 1959 },
    ];
    expect(pickPostMedia(media)).toHaveLength(2);
    expect(stripCarouselAuxiliaryImages(media)).toHaveLength(2);
  });

  it("pickPostMedia returns all carousel slides", () => {
    const media: Media[] = [
      { type: "image", url: "https://cdninstagram.com/carousel/1.jpg", width: 1080 },
      { type: "video", url: "https://cdninstagram.com/carousel/vid.mp4", width: 720 },
    ];
    expect(pickPostMedia(media)).toHaveLength(2);
  });

  it("normalize keeps multiple slides from sample-carousel.html", async () => {
    const html = await readFile(join(fixturesDir, "sample-carousel.html"), "utf8");
    const parsed = parseHtml(html, "post");
    const normalized = normalizeExtraction(parsed, {
      type: "post",
      shortcode: "CAR",
      normalized: "https://www.instagram.com/p/CAR/",
    });
    expect(normalized?.media.length).toBeGreaterThanOrEqual(2);
    expect(normalized?.media.some((m) => m.type === "video")).toBe(true);
    expect(normalized?.media.some((m) => m.type === "image")).toBe(true);
  });
});