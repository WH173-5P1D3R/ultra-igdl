import { describe, it, expect } from "vitest";
import { shortcodeToMediaPk } from "../../src/utils/shortcode.js";

describe("shortcodeToMediaPk", () => {
  it("decodes post shortcode to numeric pk", () => {
    expect(shortcodeToMediaPk("DYwr-Suk6np")).toBe("3904814273646537193");
  });

  it("returns null for invalid characters", () => {
    expect(shortcodeToMediaPk("bad!code")).toBeNull();
  });
});