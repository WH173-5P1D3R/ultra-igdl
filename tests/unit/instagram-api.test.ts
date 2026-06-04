import { describe, it, expect } from "vitest";
import {
  buildSessionCookie,
  normalizeSessionId,
  fetchStoryViaSession,
} from "../../src/network/instagram-api.js";

describe("instagram-api", () => {
  it("decodes URL-encoded sessionid", () => {
    expect(normalizeSessionId("foo%3Abar%3Abaz")).toBe("foo:bar:baz");
  });

  it("builds session cookie from sessionId", () => {
    expect(buildSessionCookie("abc123")).toBe("sessionid=abc123");
    expect(buildSessionCookie(undefined, "sessionid=x; csrftoken=y")).toBe(
      "sessionid=x; csrftoken=y"
    );
  });

  it("returns null without network session", async () => {
    const result = await fetchStoryViaSession(
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