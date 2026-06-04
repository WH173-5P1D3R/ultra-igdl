import { LRUCache } from "lru-cache";
import type { RedisAdapter } from "../types/index.js";

export interface CacheOptions {
  maxSize?: number;
  ttlMs?: number;
  /** Serve expired-but-stale entries while revalidating (default: 24h). */
  staleTtlMs?: number;
  redis?: RedisAdapter;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  staleHits: number;
  hitRate: number;
}

interface CacheEnvelope {
  payload: string;
  freshUntil: number;
  staleUntil: number;
}

export class ResponseCache {
  private lru: LRUCache<string, CacheEnvelope>;
  private redis?: RedisAdapter;
  private freshTtlMs: number;
  private staleTtlMs: number;
  private hits = 0;
  private misses = 0;
  private staleHits = 0;

  constructor(options: CacheOptions = {}) {
    this.freshTtlMs = options.ttlMs ?? 300_000;
    this.staleTtlMs = options.staleTtlMs ?? 86_400_000;
    this.lru = new LRUCache<string, CacheEnvelope>({
      max: options.maxSize ?? 500,
      ttl: this.staleTtlMs,
    });
    this.redis = options.redis;
  }

  private wrap<T>(value: T): CacheEnvelope {
    const now = Date.now();
    return {
      payload: JSON.stringify(value),
      freshUntil: now + this.freshTtlMs,
      staleUntil: now + this.staleTtlMs,
    };
  }

  /** Instant in-memory fresh hit (sub-ms). */
  getFreshSync<T>(key: string): T | null {
    const entry = this.lru.get(key);
    if (!entry || Date.now() > entry.freshUntil) return null;
    this.hits++;
    return JSON.parse(entry.payload) as T;
  }

  /** Instant stale hit for stale-while-revalidate. */
  getStaleSync<T>(key: string): T | null {
    const entry = this.lru.get(key);
    if (!entry || Date.now() > entry.staleUntil) return null;
    if (Date.now() <= entry.freshUntil) return null;
    this.staleHits++;
    return JSON.parse(entry.payload) as T;
  }

  async get<T>(key: string): Promise<T | null> {
    const fresh = this.getFreshSync<T>(key);
    if (fresh) return fresh;

    if (this.redis) {
      const remote = await this.redis.get(`ultra-igdl:${key}`);
      if (remote) {
        this.hits++;
        const parsed = JSON.parse(remote) as T;
        this.lru.set(key, this.wrap(parsed));
        return parsed;
      }
    }

    this.misses++;
    return null;
  }

  set<T>(key: string, value: T): void {
    this.lru.set(key, this.wrap(value));
    if (this.redis) {
      void this.redis.set(`ultra-igdl:${key}`, JSON.stringify(value), this.staleTtlMs);
    }
  }

  delete(key: string): void {
    this.lru.delete(key);
    this.redis?.del?.(`ultra-igdl:${key}`);
  }

  clear(): void {
    this.lru.clear();
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses + this.staleHits;
    return {
      size: this.lru.size,
      maxSize: this.lru.max,
      hits: this.hits,
      misses: this.misses,
      staleHits: this.staleHits,
      hitRate: total > 0 ? (this.hits + this.staleHits) / total : 0,
    };
  }
}