import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyLargePostImage } from "../../src/network/post-media.js";

describe("post-media", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("applies redirect URL and keeps largest dimensions", () => {
    const media = applyLargePostImage(
      [
        {
          type: "image",
          url: "https://scontent.cdninstagram.com/x.jpg?stp=c653.0.1959.1959a_s640x640",
          width: 1959,
          height: 1959,
        },
      ],
      {
        url: "https://instagram.fccj2-1.fna.fbcdn.net/v/x.jpg?stp=dst-jpg_e35_p1080x1080_tt6",
        width: 1080,
        height: 1080,
      }
    );
    expect(media[0]!.url).toContain("p1080x1080");
    expect(media[0]!.url).not.toMatch(/s640x640/);
    expect(media[0]!.width).toBe(1959);
    expect(media[0]!.height).toBe(1959);
  });

  it("does not apply one redirect URL to every carousel image", () => {
    const media = applyLargePostImage(
      [
        { type: "image", url: "https://scontent.cdninstagram.com/a.jpg", width: 1080 },
        { type: "image", url: "https://scontent.cdninstagram.com/b.jpg", width: 1080 },
      ],
      {
        url: "https://instagram.fccj2-1.fna.fbcdn.net/v/large-only.jpg?stp=p1080x1080",
        width: 1080,
        height: 1080,
      }
    );
    expect(media[0]!.url).toContain("large-only");
    expect(media[1]!.url).toBe("https://scontent.cdninstagram.com/b.jpg");
  });
});