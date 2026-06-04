import { describe, it, expect, vi } from "vitest";
import { withRetry, sleep } from "../../src/network/retry.js";

describe("retry", () => {
  it("returns on first success", async () => {
    const result = await withRetry(async () => "ok", { maxRetries: 2 });
    expect(result).toBe("ok");
  });

  it("retries on retryable errors", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) {
          const err = new Error("timeout") as Error & { statusCode?: number };
          throw err;
        }
        return "recovered";
      },
      { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 }
    );
    expect(result).toBe("recovered");
    expect(attempts).toBe(2);
  });

  it("throws after max retries", async () => {
    await expect(
      withRetry(
        async () => {
          throw new Error("timeout");
        },
        { maxRetries: 1, baseDelayMs: 5 }
      )
    ).rejects.toThrow("timeout");
  });

  it("sleep waits", async () => {
    vi.useFakeTimers();
    const p = sleep(1000);
    vi.advanceTimersByTime(1000);
    await p;
    vi.useRealTimers();
  });
});