export type MediaType = "video" | "image";

export interface Media {
  type: MediaType;
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ResponseMeta {
  extractor: string;
  version: string;
}

export interface Engagement {
  likes?: number;
  comments?: number;
  views?: number;
  shares?: number;
  /** Creator disabled public like/view counts (not the same as zero likes). */
  likesHidden?: boolean;
  /** Creator disabled comments or comment counts. */
  commentsHidden?: boolean;
  /** Raw stats line from Instagram (likes/comments prefix) when present */
  raw?: string;
}

/** Visibility / extraction hints for clients (e.g. owner hid like counts). */
export type EngagementTag =
  | "likes_hidden"
  | "comments_hidden"
  | "engagement_hidden";

/** Post shape hints (carousel detection, session needs). */
export type PostContentTag = "carousel" | "partial_carousel" | "session_recommended";

export type ResultTag = EngagementTag | PostContentTag;

export interface DownloadResponse {
  code: number;
  meta: ResponseMeta;
  media: Media[];
  /** Original post caption only (no likes/comments/shares text) */
  caption: string;
  username: string;
  /** Likes, comments, views, shares — separate from caption */
  engagement?: Engagement;
  /** e.g. likes_hidden, carousel, partial_carousel */
  tags?: ResultTag[];
  message?: string;
}

export interface ErrorResponse {
  code: number;
  message: string;
  meta?: ResponseMeta;
  /** Hint for clients when a background fetch is still running. */
  retryAfterMs?: number;
}

export type ApiResponse = DownloadResponse | ErrorResponse;

export interface UltraIgdlOptions {
  cache?: boolean;
  cacheTtlMs?: number;
  /** How long stale cache may be served while revalidating (default 24h). */
  staleCacheTtlMs?: number;
  cacheMaxSize?: number;
  redis?: RedisAdapter;
  maxConcurrency?: number;
  timeoutMs?: number;
  retries?: number;
  userAgentRotation?: boolean;
  verbose?: boolean;
  /**
   * Target max time for `download()` to return. Uses instant cache/stale hits;
   * on cold URLs returns 503 + `retryAfterMs` while fetch continues in background.
   * Set `fastMode: true` for 500ms budget.
   */
  responseBudgetMs?: number;
  /** Shorthand: `responseBudgetMs: 500`, `retries: 0`, aggressive cache. */
  fastMode?: boolean;
  /**
   * Instagram `sessionid` cookie value (from a logged-in browser).
   * Required for story downloads — Instagram does not embed story media in public HTML.
   */
  sessionId?: string;
  /** Full Cookie header override (includes sessionid, csrftoken, etc.). */
  cookies?: string;
}

export interface RedisAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  del?(key: string): Promise<void>;
}

export interface ParsedUrl {
  type: "reel" | "post" | "story" | "highlight" | "tv" | "unknown";
  shortcode?: string;
  username?: string;
  storyId?: string;
  highlightId?: string;
  storyMediaId?: string;
  normalized: string;
}

export interface ExtractionContext {
  html: string;
  url: string;
  parsed: ParsedUrl;
  sessionCookie?: string;
}

export interface ExtractedPostData {
  media: Media[];
  caption: string;
  username: string;
  engagement?: Engagement;
  tags?: ResultTag[];
  isPrivate?: boolean;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  version: string;
  uptime: number;
  cache: {
    size: number;
    maxSize: number;
    hitRate?: number;
  };
  pool: {
    connections: number;
    pending: number;
  };
}

export interface BatchResult {
  url: string;
  result: ApiResponse;
  durationMs: number;
}

export { PACKAGE_VERSION } from "../version.js";
export const EXTRACTOR_NAME = "ultra-igdl";