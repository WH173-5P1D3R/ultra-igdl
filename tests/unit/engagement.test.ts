import { describe, it, expect } from "vitest";
import {
  parseInstagramDescription,
  parseInstagramTitle,
} from "../../src/utils/engagement.js";

describe("engagement parser", () => {
  it("splits likes/comments from caption", () => {
    const r = parseInstagramDescription(
      '11K likes, 204 comments - trt1 on June 2, 2026: "Hello world".'
    );
    expect(r.caption).toBe("Hello world");
    expect(r.username).toBe("trt1");
    expect(r.engagement.likes).toBe(11000);
    expect(r.engagement.comments).toBe(204);
    expect(r.engagement.raw).toBeUndefined();
  });

  it("splits curly-quoted reel captions", () => {
    const r = parseInstagramDescription(
      '11K likes, 204 comments - trt1 on June 2, 2026: \u201cBu surlar\u201d.'
    );
    expect(r.caption).toBe("Bu surlar");
    expect(r.username).toBe("trt1");
    expect(r.engagement.likes).toBe(11000);
  });

  it("parses highlight title", () => {
    const r = parseInstagramTitle("TANITIMLAR = @mehmedfetihlersultanitrt");
    expect(r.caption).toBe("TANITIMLAR");
    expect(r.username).toBe("mehmedfetihlersultanitrt");
  });

  it("parses reel title username", () => {
    const r = parseInstagramTitle("TRT 1 (@trt1) • Instagram reel");
    expect(r.username).toBe("trt1");
  });
});