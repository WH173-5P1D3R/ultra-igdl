import { describe, it, expect } from "vitest";
import { parseCaptionFromCaptionedEmbed } from "../../src/network/embed-caption.js";

const SAMPLE = `<div class="Caption">medha_aneeshAval idam kanden……🥰🥰....#babygirl #fyp #instagoodView all 421 comments</div>
<div class="CaptionUsername">medha_aneesh</div>`;

describe("embed-caption", () => {
  it("parses caption without newline placeholders", () => {
    const cap = parseCaptionFromCaptionedEmbed(SAMPLE);
    expect(cap).toContain("Aval idam kanden");
    expect(cap).toContain("🥰");
    expect(cap).toContain("#babygirl");
    expect(cap).not.toContain("View all");
    expect(cap).not.toContain("\n.\n");
  });
});