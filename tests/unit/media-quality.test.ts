import { describe, it, expect } from "vitest";
import {
  upgradeImageUrl,
  dimensionsFromImageUrl,
  isStoryProfileImage,
} from "../../src/utils/media-quality.js";

describe("media-quality", () => {
  it("preserves signed CDN URLs (no query rewriting)", () => {
    const url =
      "https://scontent.cdninstagram.com/x.webp?stp=c288.0.864.864a_dst-jpg_e35_s640x640_tt6&oh=abc&oe=def";
    expect(upgradeImageUrl(url)).toBe(url);
  });

  it("reads dimensions from stp crop", () => {
    const dims = dimensionsFromImageUrl(
      "https://scontent.cdninstagram.com/x.webp?stp=c288.0.864.864a_dst-jpg"
    );
    expect(dims.width).toBe(864);
    expect(dims.height).toBe(864);
  });

  it("detects story profile images", () => {
    expect(
      isStoryProfileImage(
        "https://scontent.cdninstagram.com/v/t51.2885-19/427516699.jpg?stp=dst-jpg_s206x206"
      )
    ).toBe(true);
  });
});