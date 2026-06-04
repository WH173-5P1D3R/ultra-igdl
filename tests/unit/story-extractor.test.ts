import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractStory } from "../../src/extractors/story.js";
import { extractPost } from "../../src/extractors/post.js";
import { parseInstagramUrl } from "../../src/utils/urls.js";

const load = (f: string) => readFile(join(process.cwd(), "tests/fixtures", f), "utf-8");

describe("story and post edge cases", () => {
  it("story returns null when page not found", async () => {
    const html = "Sorry, this page isn't available";
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/u/1/");
    const result = await extractStory({ html, url: parsed.normalized, parsed });
    expect(result).toBeNull();
  });

  it("post throws when rate limited", async () => {
    const html = await load("rate-limited.html");
    const parsed = parseInstagramUrl("https://www.instagram.com/p/X/");
    await expect(
      extractPost({ html, url: parsed.normalized, parsed })
    ).rejects.toMatchObject({ message: "Rate limited" });
  });

  it("story uses username from parsed url", async () => {
    const html = `<html><head>
      <meta property="og:image" content="https://scontent.cdninstagram.com/v/t51.2885-19/profile.jpg?stp=dst-jpg_s206x206" />
    </head></html>`;
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/fallbackuser/1/");
    const result = await extractStory({ html, url: parsed.normalized, parsed });
    expect(result?.username).toBe("fallbackuser");
    expect(result?.media.every((m) => !m.url.includes("2885-19"))).toBe(true);
  });
});