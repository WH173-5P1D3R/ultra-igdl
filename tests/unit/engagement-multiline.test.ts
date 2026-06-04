import { describe, it, expect } from "vitest";
import { parseInstagramDescription } from "../../src/utils/engagement.js";

describe("engagement multiline captions", () => {
  it("keeps full caption after stats prefix", () => {
    const raw =
      '40000 likes, 417 comments - medha_aneesh on June 1, 2026: "Aval idam kanden…….\n.\n.\n.\n#babygirl #fyp #instagood".';
    const r = parseInstagramDescription(raw);
    expect(r.caption).toContain("Aval idam kanden");
    expect(r.caption).toContain("#babygirl");
    expect(r.caption.split("\n").length).toBeGreaterThan(2);
  });
});