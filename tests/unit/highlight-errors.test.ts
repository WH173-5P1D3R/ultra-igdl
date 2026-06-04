import { describe, it, expect } from "vitest";
import { extractHighlight } from "../../src/extractors/highlight.js";
import { parseInstagramUrl } from "../../src/utils/urls.js";

describe("highlight errors", () => {
  it("returns null when not found", async () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/highlights/1/");
    const result = await extractHighlight({
      html: "Sorry, this page isn't available",
      url: parsed.normalized,
      parsed,
    });
    expect(result).toBeNull();
  });

  it("throws on rate limit", async () => {
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/highlights/1/");
    await expect(
      extractHighlight({
        html: "Please wait a few minutes rate limit",
        url: parsed.normalized,
        parsed,
      })
    ).rejects.toMatchObject({ message: "Rate limited" });
  });
});