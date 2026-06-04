import { describe, it, expect } from "vitest";
import { validateUrl } from "../../src/utils/validators.js";

describe("validators", () => {
  it("rejects empty input", () => {
    expect(validateUrl("").valid).toBe(false);
  });

  it("rejects invalid format", () => {
    expect(validateUrl("not a url").valid).toBe(false);
  });

  it("rejects non-Instagram URLs", () => {
    expect(validateUrl("https://google.com").valid).toBe(false);
  });

  it("accepts valid reel URL", () => {
    const result = validateUrl("https://www.instagram.com/reel/ABC/");
    expect(result.valid).toBe(true);
    expect(result.type).toBe("reel");
    expect(result.normalized).toContain("reel/ABC");
  });
});