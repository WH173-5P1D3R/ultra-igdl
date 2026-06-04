import { describe, it, expect } from "vitest";
import { closePool, getAgent } from "../../src/network/pool.js";

describe("pool close", () => {
  it("closes pool and agent", async () => {
    getAgent();
    await closePool();
    await expect(closePool()).resolves.toBeUndefined();
  });
});