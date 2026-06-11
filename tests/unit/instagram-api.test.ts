import { describe, it, expect, vi, afterEach } from "vitest";
import * as instagramApi from "../../src/network/instagram-api.js";
import * as requestModule from "../../src/network/request.js";

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

  it("detects rejected session from media/info status", async () => {
    vi.spyOn(requestModule, "request").mockResolvedValue({
      statusCode: 302,
      headers: {},
      body: { text: async () => "" },
    } as never);

    const rejected = await instagramApi.isSessionApiRejected(
      "sessionid=bad; csrftoken=bad; ds_user_id=1",
      "https://www.instagram.com/reel/ABC/",
      "12345"
    );
    expect(rejected).toBe(true);
  });

  it("returns null when story API paths yield nothing (no live network)", async () => {
    vi.spyOn(requestModule, "request").mockResolvedValue({
      statusCode: 404,
      headers: {},
      body: { text: async () => "" },
    } as never);

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