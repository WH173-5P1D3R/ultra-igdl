import { request } from "./request.js";
import { buildHeaders, buildInstagramPageHeaders } from "./headers.js";
import { withRetry } from "./retry.js";
import { getAgent } from "./pool.js";
import { logger } from "../utils/logger.js";

export interface FetchResult {
  body: string;
  statusCode: number;
  headers: Record<string, string>;
}

export interface HttpClientOptions {
  timeoutMs?: number;
  retries?: number;
  userAgentRotation?: boolean;
}

const inFlight = new Map<string, Promise<FetchResult>>();
const inFlightCookie = new Map<string, Promise<FetchResult>>();

export class HttpClient {
  private timeoutMs: number;
  private retries: number;
  private userAgentRotation: boolean;

  constructor(options: HttpClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.retries = options.retries ?? 2;
    this.userAgentRotation = options.userAgentRotation ?? true;
  }

  async fetchWithCookie(url: string, cookie: string, dedupe = true): Promise<FetchResult> {
    const key = `${url}\0${cookie.slice(0, 48)}`;
    if (dedupe && inFlightCookie.has(key)) {
      return inFlightCookie.get(key)!;
    }

    const promise = this.fetchWithCookieInternal(url, cookie);
    if (dedupe) {
      inFlightCookie.set(key, promise);
      promise.finally(() => inFlightCookie.delete(key));
    }
    return promise;
  }

  private async fetchWithCookieInternal(url: string, cookie: string): Promise<FetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await request(url, {
        method: "GET",
        headers: { ...buildInstagramPageHeaders(), Cookie: cookie },
        signal: controller.signal,
      });
      const body = await response.body.text();
      const resHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === "string") resHeaders[key] = value;
        else if (Array.isArray(value)) resHeaders[key] = value.join(", ");
      }
      return { body, statusCode: response.statusCode, headers: resHeaders };
    } finally {
      clearTimeout(timer);
    }
  }

  async fetch(url: string, dedupe = true): Promise<FetchResult> {
    if (dedupe && inFlight.has(url)) {
      return inFlight.get(url)!;
    }

    const promise = this.fetchInternal(url);
    if (dedupe) {
      inFlight.set(url, promise);
      promise.finally(() => inFlight.delete(url));
    }
    return promise;
  }

  private async fetchInternal(url: string): Promise<FetchResult> {
    return withRetry(
      async (attempt) => {
        const headers = buildHeaders(url, this.userAgentRotation || attempt > 0);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          logger.debug(`Fetching ${url} (attempt ${attempt + 1})`);
          // Page HTML must not use the shared pool agent — Instagram serves
          // minimal/blocked markup through pooled connections.
          const usePool =
            url.includes("cdninstagram") ||
            url.includes("fbcdn.net") ||
            url.includes("fbsbx.com");

          const response = await request(url, {
            method: "GET",
            headers,
            ...(usePool ? { dispatcher: getAgent() } : {}),
            signal: controller.signal,
          });

          const body = await response.body.text();
          const statusCode = response.statusCode;
          const resHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            if (typeof value === "string") resHeaders[key] = value;
            else if (Array.isArray(value)) resHeaders[key] = value.join(", ");
          }

          if (statusCode === 429) {
            const err = new Error("Rate limited") as Error & { statusCode: number };
            err.statusCode = 429;
            throw err;
          }

          if (statusCode >= 500) {
            const err = new Error(`Server error ${statusCode}`) as Error & {
              statusCode: number;
            };
            err.statusCode = statusCode;
            throw err;
          }

          return { body, statusCode, headers: resHeaders };
        } finally {
          clearTimeout(timer);
        }
      },
      { maxRetries: this.retries }
    );
  }

  getInFlightCount(): number {
    return inFlight.size;
  }
}