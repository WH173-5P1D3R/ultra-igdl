import { describe, it, expect } from "vitest";
import {
  normalizeInstagramUrl,
  parseInstagramUrl,
  isInstagramUrl,
  shortcodeToMediaUrl,
} from "../../src/utils/urls.js";

describe("urls", () => {
  it("normalizes reel URLs", () => {
    const url = normalizeInstagramUrl("instagram.com/reel/ABC123");
    expect(url).toBe("https://www.instagram.com/reel/ABC123/");
  });

  it("parses post URLs", () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/p/XYZ/");
    expect(parsed.type).toBe("post");
    expect(parsed.shortcode).toBe("XYZ");
  });

  it("parses reel URLs", () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/reel/REEL1/");
    expect(parsed.type).toBe("reel");
    expect(parsed.shortcode).toBe("REEL1");
  });

  it("parses story URLs", () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/user/123/");
    expect(parsed.type).toBe("story");
    expect(parsed.username).toBe("user");
    expect(parsed.storyId).toBe("123");
  });

  it("parses highlight URLs", () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/highlights/999/");
    expect(parsed.type).toBe("highlight");
    expect(parsed.highlightId).toBe("999");
  });

  it("parses tv URLs", () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/tv/TV1/");
    expect(parsed.type).toBe("tv");
  });

  it("detects invalid URLs", () => {
    expect(isInstagramUrl("https://example.com/p/abc")).toBe(false);
  });

  it("shortcodeToMediaUrl builds correct paths", () => {
    expect(shortcodeToMediaUrl("abc", "reel")).toContain("/reel/abc/");
    expect(shortcodeToMediaUrl("abc", "post")).toContain("/p/abc/");
  });

  it("parses /s/ highlight share links", () => {
    const parsed = parseInstagramUrl(
      "https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDIxNzUxNzU3MDA1NDk1?story_media_id=123"
    );
    expect(parsed.type).toBe("highlight");
    expect(parsed.highlightId).toBe("18021751757005495");
    expect(parsed.storyMediaId).toBe("123");
    expect(isInstagramUrl(parsed.normalized)).toBe(true);
  });
});