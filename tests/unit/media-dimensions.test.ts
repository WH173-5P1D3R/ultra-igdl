import { describe, it, expect } from "vitest";
import {
  maxOriginalDimensionsFromHtml,
  enrichImageDimensions,
  imageNeedsHigherResolution,
  postNeedsEmbedFetch,
} from "../../src/utils/media-dimensions.js";

describe("media-dimensions", () => {
  it("reads original_width from HTML", () => {
    const html = '{"original_width":1080,"original_height":1350,"display_url":"x"}';
    expect(maxOriginalDimensionsFromHtml(html)).toEqual({
      width: 1080,
      height: 1350,
    });
  });

  it("prefers original dimensions over crop token in URL", () => {
    const html =
      '{"original_width":1440,"original_height":1800,"image_versions2":{"candidates":[{"width":640,"height":800,"url":"https://cdn/x.jpg"}]}}';
    const media = enrichImageDimensions(
      {
        type: "image",
        url: "https://scontent.cdninstagram.com/x.jpg?stp=c100.0.640.640a",
        width: 640,
        height: 640,
      },
      html
    );
    expect(media.width).toBe(1440);
    expect(media.height).toBe(1800);
  });

  it("reads stp crop dimensions from CDN URL when JSON absent", () => {
    const media = enrichImageDimensions(
      {
        type: "image",
        url: "https://scontent.cdninstagram.com/x.jpg?stp=c653.0.1959.1959a_dst-jpg_e35",
      },
      ""
    );
    expect(media.width).toBe(1959);
    expect(media.height).toBe(1959);
  });

  it("detects low-res delivery URL needing embed", () => {
    const media = [
      {
        type: "image" as const,
        url: "https://scontent.cdninstagram.com/x.jpg?stp=c653.0.1959.1959a_s640x640",
        width: 1959,
        height: 1959,
      },
    ];
    expect(imageNeedsHigherResolution(media)).toBe(true);
    expect(postNeedsEmbedFetch(media)).toBe(true);
  });
});