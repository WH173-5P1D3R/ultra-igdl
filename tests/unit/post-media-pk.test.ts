import { describe, it, expect } from "vitest";
import { postMediaPkCandidates } from "../../src/utils/post-media-pk.js";

describe("postMediaPkCandidates", () => {
  it("uses only shortcode pk when shortcode is known", () => {
    const html =
      'content="https://cdninstagram.com/x.jpg?ig_cache_key=MzkwNDgxMzc5NzE0ODQ1MTQzNA%3D%3D"';
    const pks = postMediaPkCandidates("DYwr-Suk6np", html);
    expect(pks).toEqual(["3904814273646537193"]);
  });
});