import { describe, it, expect } from "vitest";
import { getAgent, getPool, getPoolStats } from "../../src/network/pool.js";

describe("pool", () => {
  it("returns singleton agent", () => {
    const a1 = getAgent();
    const a2 = getAgent();
    expect(a1).toBe(a2);
  });

  it("returns pool stats", () => {
    const stats = getPoolStats();
    expect(stats.connections).toBeGreaterThan(0);
  });

  it("returns instagram pool", () => {
    const pool = getPool();
    expect(pool).toBeDefined();
  });
});