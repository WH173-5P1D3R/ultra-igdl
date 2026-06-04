import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseHtml } from "../../src/core/parser.js";
import { extractHighlight } from "../../src/extractors/highlight.js";
import { parseInstagramUrl } from "../../src/utils/urls.js";

const load = (f: string) => readFile(join(process.cwd(), "tests/fixtures", f), "utf-8");

describe("parser extended", () => {
  it("parses fallback-only HTML", async () => {
    const html = await load("fallback-only.html");
    const result = parseHtml(html);
    expect(result?.media.some((m) => m.type === "video")).toBe(true);
    expect(result?.media.some((m) => m.type === "image")).toBe(true);
  });

  it("extractHighlight finds extra videos", async () => {
    const html = await load("sample-highlight.html");
    const parsed = parseInstagramUrl("https://www.instagram.com/stories/highlights/HL/");
    const result = await extractHighlight({ html, url: parsed.normalized, parsed });
    expect(result?.media.length).toBeGreaterThan(0);
  });

  it("handles graphql doc_id discovery", async () => {
    const html = `<html><body>"doc_id":"12345","video_url":"https://cdninstagram.com/gql/v.mp4"</body></html>`;
    const result = parseHtml(html);
    expect(result?.media.length).toBeGreaterThan(0);
  });
});