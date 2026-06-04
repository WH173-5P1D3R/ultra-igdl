import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseHtml,
  pickBestImage,
  pickBestVideo,
  detectRateLimit,
  detectNotFound,
} from "../../src/core/parser.js";
import type { Media } from "../../src/types/index.js";

const fixtures = (name: string) =>
  readFile(join(process.cwd(), "tests/fixtures", name), "utf-8");

describe("parser", () => {
  it("extracts from JSON-LD and shared data (post fixture)", async () => {
    const html = await fixtures("sample-post.html");
    const result = parseHtml(html);
    expect(result).not.toBeNull();
    expect(result!.media.length).toBeGreaterThan(0);
    expect(result!.username).toBeTruthy();
  });

  it("extracts highest quality video from reel fixture", async () => {
    const html = await fixtures("sample-reel.html");
    const result = parseHtml(html);
    expect(result).not.toBeNull();
    const video = result!.media.find((m) => m.type === "video");
    expect(video).toBeDefined();
    expect(video!.width).toBe(1080);
    expect(video!.duration).toBe(25);
  });

  it("extracts carousel media", async () => {
    const html = await fixtures("sample-carousel.html");
    const result = parseHtml(html);
    expect(result).not.toBeNull();
    expect(result!.media.length).toBeGreaterThanOrEqual(2);
    expect(result!.caption).toContain("Carousel");
  });

  it("detects private/login pages", async () => {
    const html = await fixtures("private.html");
    const result = parseHtml(html);
    expect(result?.isPrivate).toBe(true);
  });

  it("detects rate limit", async () => {
    const html = await fixtures("rate-limited.html");
    expect(detectRateLimit(html)).toBe(true);
  });

  it("detects not found", () => {
    expect(detectNotFound("Sorry, this page isn't available", 200)).toBe(true);
    expect(detectNotFound("", 404)).toBe(true);
  });

  it("pickBestImage selects largest dimensions", () => {
    const images: Media[] = [
      { type: "image", url: "a", width: 640, height: 640 },
      { type: "image", url: "b", width: 1080, height: 1080 },
    ];
    const best = pickBestImage(images);
    expect(best!.url).toBe("b");
  });

  it("pickBestVideo selects highest resolution", () => {
    const videos: Media[] = [
      { type: "video", url: "a", width: 480, height: 854 },
      { type: "video", url: "b", width: 1080, height: 1920 },
    ];
    const best = pickBestVideo(videos);
    expect(best!.url).toBe("b");
  });

  it("returns null for empty HTML", () => {
    expect(parseHtml("<html></html>")).toBeNull();
  });
});