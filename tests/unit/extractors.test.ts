import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractPost } from "../../src/extractors/post.js";
import { extractReel } from "../../src/extractors/reel.js";
import { extractStory } from "../../src/extractors/story.js";
import { extractHighlight } from "../../src/extractors/highlight.js";
import { parseInstagramUrl } from "../../src/utils/urls.js";

const load = (f: string) => readFile(join(process.cwd(), "tests/fixtures", f), "utf-8");

describe("extractors", () => {
  it("extractPost returns media", async () => {
    const html = await load("sample-post.html");
    const parsed = parseInstagramUrl("https://www.instagram.com/p/ABC/");
    const result = await extractPost({ html, url: parsed.normalized, parsed });
    expect(result?.media.length).toBeGreaterThan(0);
  });

  it("extractReel returns video", async () => {
    const html = await load("sample-reel.html");
    const parsed = parseInstagramUrl("https://www.instagram.com/reel/REEL/");
    const result = await extractReel({ html, url: parsed.normalized, parsed });
    expect(result?.media.some((m) => m.type === "video")).toBe(true);
  });

  it("extractStory assigns username", async () => {
    const html = await load("sample-reel.html");
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/user/1/");
    const result = await extractStory({ html, url: parsed.normalized, parsed });
    expect(result?.username).toBe("user");
  });

  it("extractHighlight aggregates media", async () => {
    const html = await load("sample-reel.html");
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/highlights/1/");
    const result = await extractHighlight({ html, url: parsed.normalized, parsed });
    expect(result).not.toBeNull();
  });

  it("throws on rate limit", async () => {
    const html = await load("rate-limited.html");
    const parsed = parseInstagramUrl("https://www.instagram.com/p/X/");
    await expect(
      extractPost({ html, url: parsed.normalized, parsed })
    ).rejects.toMatchObject({ message: "Rate limited" });
  });
});