import { describe, it, expect } from "vitest";
import { withRetry } from "../../src/network/retry.js";

describe("retry status codes", () => {
  it("retries on 502", async () => {
    let n = 0;
    const result = await withRetry(
      async () => {
        n++;
        if (n < 2) {
          throw Object.assign(new Error("Server error"), { statusCode: 502 });
        }
        return "ok";
      },
      { maxRetries: 2, baseDelayMs: 5 }
    );
    expect(result).toBe("ok");
  });
});