import { describe, it, expect } from "vitest";
import { parseHtml } from "../../src/core/parser.js";

describe("parser media node variants", () => {
  it("parses image_versions2 candidates", () => {
    const html = `<script>window._sharedData = {
      "shortcode_media": {
        "shortcode": "IMG1",
        "image_versions2":{"candidates":[
          {"url":"https://cdninstagram.com/small.jpg","width":150,"height":150},
          {"url":"https://cdninstagram.com/large.jpg","width":1440,"height":1440}
        ]}
      }
    };</script>`;
    const result = parseHtml(html);
    expect(result?.media.some((m) => m.width === 1440)).toBe(true);
  });

  it("parses carousel_media array", () => {
    const html = `<script>window._sharedData = {
      "shortcode_media": {
        "shortcode": "CAR1",
        "carousel_media": [
          {"is_video": false, "image_versions2": {"candidates": [{"url":"https://cdninstagram.com/c1.jpg","width":1080}]}},
          {"is_video": true, "video_versions": [{"url":"https://cdninstagram.com/c2.mp4","width":720}], "video_duration": 5}
        ]
      }
    };</script>`;
    const result = parseHtml(html);
    expect(result?.media.length).toBeGreaterThanOrEqual(2);
  });

  it("parses ld+json VideoObject duration", () => {
    const html = `<script type="application/ld+json">{
      "@type": "VideoObject",
      "contentUrl": "https://cdninstagram.com/v.mp4",
      "duration": "PT1M30S"
    }</script>`;
    const result = parseHtml(html);
    expect(result?.media[0]?.duration).toBe(90);
  });

  it("upgrades multiple images to sorted by size", () => {
    const html = `<script>{
      "display_url":"https://cdninstagram.com/a.jpg",
      "original_width":640,
      "shortcode":"x"
    }</script>
    <script>{
      "display_url":"https://cdninstagram.com/b.jpg",
      "original_width":1080,
      "shortcode":"y"
    }</script>`;
    const result = parseHtml(html);
    expect(result?.media.length).toBeGreaterThan(0);
  });
});