import { describe, it, expect } from "vitest";
import { generateFilename } from "../../src/utils/downloader.js";
import type { Media } from "../../src/types/index.js";

describe("downloader utils", () => {
  it("generateFilename creates video extension", () => {
    const media: Media = {
      type: "video",
      url: "https://cdninstagram.com/v/abc.mp4?param=1",
    };
    const name = generateFilename(media, 0);
    expect(name).toMatch(/\.mp4$/);
    expect(name).toContain("video_1");
  });

  it("generateFilename creates image extension", () => {
    const media: Media = {
      type: "image",
      url: "https://cdninstagram.com/p/photo.jpg",
    };
    const name = generateFilename(media, 1);
    expect(name).toContain("image_2");
  });
});