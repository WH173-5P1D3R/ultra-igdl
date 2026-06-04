import { describe, it, expect } from "vitest";
import { ResponseCache } from "../../src/core/cache.js";

describe("cache redis paths", () => {
  it("loads from redis when memory empty", async () => {
    const store = new Map<string, string>();
    const redis = {
      get: async (k: string) => store.get(k) ?? null,
      set: async (k: string, v: string) => {
        store.set(k, v);
      },
    };
    store.set("ultra-igdl:remote-key", JSON.stringify({ v: 42 }));

    const cache = new ResponseCache({ redis, maxSize: 10 });
    const val = await cache.get<{ v: number }>("remote-key");
    expect(val?.v).toBe(42);
    expect(cache.getStats().hits).toBe(1);
  });

  it("delete clears redis key", async () => {
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
    const cache = new ResponseCache({ redis });
    await cache.set("delme", 1);
    cache.delete("delme");
    expect(await cache.get("delme")).toBeNull();
    expect(store.has("ultra-igdl:delme")).toBe(false);
  });
});