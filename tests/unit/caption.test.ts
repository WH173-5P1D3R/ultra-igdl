import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pickBestCaption,
  captionWithoutEngagementPrefix,
  resolveCaptionForContent,
} from "../../src/utils/caption.js";
import {
  normalizeCaptionText,
  normalizePostCaptionText,
  unescapeCaptionEscapes,
} from "../../src/utils/caption-normalize.js";
import { extractCaptionFromApiItem } from "../../src/utils/caption.js";
import { parseInstagramDescription } from "../../src/utils/engagement.js";
import { extractPageMeta } from "../../src/core/normalize.js";

describe("caption utils", () => {
  it("preserves internal newlines", () => {
    expect(normalizeCaptionText("line1\\nline2\\nline3")).toBe("line1\nline2\nline3");
  });

  it("flattens Instagram post caption dot separators to one line", () => {
    const raw =
      "\n.\n.\nMake up @starstruckbysl \nStyled by @styledbytanyak\n#sunnyleone #trending";
    const out = normalizePostCaptionText(raw);
    expect(out).not.toContain("\n");
    expect(out).toBe(
      "Make up @starstruckbysl Styled by @styledbytanyak #sunnyleone #trending"
    );
  });

  it("unescapes double-escaped newlines from API/HTML", () => {
    expect(unescapeCaptionEscapes("hello\\\\nworld")).toBe("hello\nworld");
    expect(
      extractCaptionFromApiItem({
        caption: { text: "First line\\nSecond line" },
      })
    ).toBe("First line\nSecond line");
  });

  it("picks the longer caption", () => {
    expect(pickBestCaption("short", "longer caption text")).toBe("longer caption text");
  });

  it("strips engagement prefix before comparing length", () => {
    const wrapped =
      '41K likes, 419 comments - user on June 2, 2026: "Aval idam kanden".';
    const plain = "Aval idam kanden…….\n.\n.\n.\n#babygirl";
    expect(pickBestCaption(wrapped, plain)).toBe(plain);
    expect(captionWithoutEngagementPrefix(wrapped)).toBe("Aval idam kanden");
  });

  it("prefers embed caption for reels over og newline formatting", () => {
    const og = "Aval idam kanden…….\n.\n.\n.\n#babygirl #fyp";
    const embed = "Aval idam kanden……🥰🥰....#babygirl #fyp #instagood";
    expect(resolveCaptionForContent("reel", { embed, og, extracted: og })).toBe(embed);
  });

  it("parses multiline og:description from live HTML", () => {
    const html = readFileSync(join(import.meta.dirname, "../fixtures/live-reel.html"), "utf8");
    const meta = extractPageMeta(html);
    const parsed = parseInstagramDescription(meta.ogDescription ?? "");
    expect(parsed.caption).toContain("MehmedFetihlerSultan");
    expect(parsed.caption).toContain("83. Bölüm");
    expect(parsed.caption.split("\n").length).toBeGreaterThan(1);
  });
});