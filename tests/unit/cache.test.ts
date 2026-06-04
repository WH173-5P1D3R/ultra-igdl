import { describe, it, expect, beforeEach } from "vitest";
import { ResponseCache } from "../../src/core/cache.js";

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ maxSize: 10, ttlMs: 60_000 });
  });

  it("stores and retrieves values", async () => {
    await cache.set("key1", { code: 200, data: "test" });
    const value = await cache.get<{ code: number; data: string }>("key1");
    expect(value?.data).toBe("test");
  });

  it("returns null for missing keys", async () => {
    expect(await cache.get("missing")).toBeNull();
  });

  it("tracks hit rate", async () => {
    cache.set("a", 1);
    await cache.get("a");
    await cache.get("b");
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });

  it("getFreshSync returns instantly", () => {
    cache.set("sync", { ok: true });
    expect(cache.getFreshSync<{ ok: boolean }>("sync")?.ok).toBe(true);
  });

  it("getStaleSync serves after fresh window", async () => {
    const short = new ResponseCache({ maxSize: 5, ttlMs: 1, staleTtlMs: 60_000 });
    short.set("s", { v: 1 });
    expect(short.getFreshSync("s")).toEqual({ v: 1 });
    await new Promise((r) => setTimeout(r, 5));
    expect(short.getFreshSync("s")).toBeNull();
    expect(short.getStaleSync<{ v: number }>("s")?.v).toBe(1);
  });

  it("clears cache", async () => {
    await cache.set("x", 1);
    cache.clear();
    expect(cache.getStats().size).toBe(0);
  });

  it("works with redis adapter", async () => {
    const store = new Map<string, string>();
    const redis = {
      get: async (k: string) => store.get(k) ?? null,
      set: async (k: string, v: string) => {
        store.set(k, v);
      },
      del: async (k: string) => {
        store.delete(k);
      },
    };
    const redisCache = new ResponseCache({ redis, maxSize: 5 });
    await redisCache.set("remote", { ok: true });
    const val = await redisCache.get<{ ok: boolean }>("remote");
    expect(val?.ok).toBe(true);
  });
});