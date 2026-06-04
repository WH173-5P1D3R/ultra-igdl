import { describe, it, expect } from "vitest";
import {
  buildEngagementTags,
  ogDescriptionHasPublicCounts,
} from "../../src/utils/engagement-tags.js";

describe("engagement tags", () => {
  it("detects public counts prefix", () => {
    expect(ogDescriptionHasPublicCounts("41K likes, 419 comments - user on June 2")).toBe(
      true
    );
    expect(
      ogDescriptionHasPublicCounts('user on June 3, 2026: "caption here"')
    ).toBe(false);
  });

  it("tags likes_hidden when og has no public counts", () => {
    const tags = buildEngagementTags(
      "reel",
      'osmanlimirasi_ on June 3, 2026: "Fatih Sultan Mehmed"',
      {},
      ""
    );
    expect(tags).toContain("likes_hidden");
  });
});