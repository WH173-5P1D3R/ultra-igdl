import { describe, it, expect, vi, afterEach } from "vitest";
import * as instagramApi from "../../src/network/instagram-api.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("instagram-api", () => {
  it("decodes URL-encoded sessionid", () => {
    expect(instagramApi.normalizeSessionId("foo%3Abar%3Abaz")).toBe("foo:bar:baz");
  });

  it("builds session cookie from sessionId", () => {
    expect(instagramApi.buildSessionCookie("abc123")).toBe("sessionid=abc123");
    expect(instagramApi.buildSessionCookie(undefined, "sessionid=x; csrftoken=y")).toBe(
      "sessionid=x; csrftoken=y"
    );
  });

  it("returns null when story API paths yield nothing (no live network)", async () => {
    vi.spyOn(instagramApi, "fetchMediaInfoByPk").mockResolvedValue(null);
    vi.spyOn(instagramApi, "fetchStoryPageWithSession").mockResolvedValue({
      statusCode: 404,
      body: "",
    });
    vi.spyOn(instagramApi, "fetchUserId").mockResolvedValue(null);

    const result = await instagramApi.fetchStoryViaSession(
      {
        type: "story",
        username: "nobody",
        storyId: "1",
        normalized: "https://www.instagram.com/stories/nobody/1/",
      },
      "sessionid=invalid"
    );
    expect(result).toBeNull();
  });
});