import type {
  ApiResponse,
  DownloadResponse,
  ErrorResponse,
  UltraIgdlOptions,
  BatchResult,
  HealthStatus,
  ExtractedPostData,
  Media,
} from "../types/index.js";
import { PACKAGE_VERSION, EXTRACTOR_NAME } from "../types/index.js";
import { HttpClient } from "../network/client.js";
import { ResponseCache } from "./cache.js";
import {
  runExtractor,
  resolveFetchUrl,
  resolveEmbedUrl,
  resolveStoryEmbedUrl,
} from "./extractor.js";
import {
  mergeExtracted,
  needsVideoEmbedFallback,
  parseEmbedHtml,
} from "./parser.js";
import { normalizeExtraction, extractPageMeta } from "./normalize.js";
import {
  filterValidMedia,
  isCdnMediaUrl,
  isValidThumbnailUrl,
} from "../utils/media-quality.js";
import { imageNeedsHigherResolution, postNeedsEmbedFetch } from "../utils/media-dimensions.js";
import {
  applyLargePostImage,
  fetchPostLargeImageUrl,
} from "../network/post-media.js";
import {
  captionedEmbedUrl,
  contentTypesWithEmbedCaption,
  parseCaptionFromCaptionedEmbed,
} from "../network/embed-caption.js";
import {
  buildSessionCookie,
  enrichSessionCookie,
  fetchStoryViaSession,
  fetchMediaInfoByPk,
  isSessionApiRejected,
  userIdFromCookie,
  sessionCookieReady,
} from "../network/instagram-api.js";
import { extractMediaPkFromHtml } from "../utils/media-id.js";
import { postMediaPkCandidates } from "../utils/post-media-pk.js";
import { shortcodeToMediaPk } from "../utils/shortcode.js";
import {
  buildPostContentTags,
  htmlIndicatesCarouselPost,
  mergeResultTags,
} from "../utils/post-carousel-detect.js";
import { parseInstagramUrl } from "../utils/urls.js";
import { validateUrl } from "../utils/validators.js";
import { logger } from "../utils/logger.js";
import { getPoolStats } from "../network/pool.js";
import { sleep } from "../network/retry.js";

const pendingDownloads = new Map<string, Promise<ApiResponse>>();

function hasStoryVideo(media: Media[]): boolean {
  return media.some((m) => m.type === "video" && isCdnMediaUrl(m.url));
}

function hasReelVideo(media: Media[]): boolean {
  return media.some((m) => m.type === "video" && isCdnMediaUrl(m.url));
}

export class DownloaderCore {
  private client: HttpClient;
  private cache: ResponseCache;
  private options: UltraIgdlOptions;
  private startTime = Date.now();
  private semaphore: { max: number; current: number; queue: Array<() => void> };

  constructor(options: UltraIgdlOptions = {}) {
    const fastMode = options.fastMode === true;
    const responseBudgetMs = fastMode ? 500 : options.responseBudgetMs;

    this.options = {
      cache: true,
      cacheTtlMs: 300_000,
      staleCacheTtlMs: 86_400_000,
      cacheMaxSize: 500,
      maxConcurrency: 100,
      timeoutMs: 8_000,
      retries: 2,
      userAgentRotation: true,
      ...options,
      responseBudgetMs,
      fastMode,
    };

    if (responseBudgetMs) {
      this.options.retries = 0;
      this.options.cache = this.options.cache !== false;
    }

    this.client = new HttpClient({
      timeoutMs: this.options.timeoutMs,
      retries: this.options.retries,
      userAgentRotation: this.options.userAgentRotation,
    });

    this.cache = new ResponseCache({
      maxSize: this.options.cacheMaxSize,
      ttlMs: this.options.cacheTtlMs,
      staleTtlMs: this.options.staleCacheTtlMs,
      redis: this.options.redis,
    });

    this.semaphore = {
      max: this.options.maxConcurrency ?? 100,
      current: 0,
      queue: [],
    };
  }

  private async acquire(): Promise<void> {
    if (this.semaphore.current < this.semaphore.max) {
      this.semaphore.current++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.semaphore.queue.push(() => {
        this.semaphore.current++;
        resolve();
      });
    });
  }

  private release(): void {
    this.semaphore.current--;
    const next = this.semaphore.queue.shift();
    if (next) next();
  }

  private meta() {
    return { extractor: EXTRACTOR_NAME, version: PACKAGE_VERSION };
  }

  private success(data: ExtractedPostData): DownloadResponse {
    return {
      code: 200,
      meta: this.meta(),
      media: data.media,
      caption: data.caption,
      username: data.username,
      engagement: data.engagement,
      tags: data.tags,
    };
  }

  private error(code: number, message: string, retryAfterMs?: number): ErrorResponse {
    return { code, message, meta: this.meta(), retryAfterMs };
  }

  private startDownloadTask(
    cacheKey: string,
    parsed: ReturnType<typeof parseInstagramUrl>
  ): Promise<ApiResponse> {
    return (async () => {
      await this.acquire();
      try {
        const result = await this.fetchAndExtract(parsed);
        if (this.options.cache !== false && result.code === 200) {
          this.cache.set(cacheKey, result);
        }
        return result;
      } catch (err: unknown) {
        logger.error("Background extraction failed", err);
        return this.error(500, err instanceof Error ? err.message : "Extraction failed");
      } finally {
        this.release();
      }
    })();
  }

  /** API-only attempt for story/highlight (fits ~500ms budget). */
  private async fetchFastExtract(
    parsed: ReturnType<typeof parseInstagramUrl>
  ): Promise<ApiResponse | null> {
    const budget = this.options.responseBudgetMs;
    if (!budget) return null;

    const sessionCookie = buildSessionCookie(
      this.options.sessionId,
      this.options.cookies
    );
    if (!sessionCookie || !sessionCookieReady(sessionCookie)) return null;

    const apiMs = Math.max(250, budget - 80);
    try {
      if (parsed.type === "story" && parsed.storyId) {
        const fromApi = await fetchMediaInfoByPk(
          parsed.storyId,
          sessionCookie,
          parsed.normalized,
          userIdFromCookie(sessionCookie) ?? undefined,
          apiMs
        );
        const media = filterValidMedia(fromApi?.media ?? []);
        if (!hasStoryVideo(media)) return null;
        const extracted = normalizeExtraction(
          {
            ...fromApi!,
            media,
            caption: "",
            username: parsed.username ?? fromApi!.username,
          },
          parsed,
          {},
          ""
        );
        return extracted?.media.length ? this.success(extracted) : null;
      }

      if (parsed.type === "highlight" && parsed.storyMediaId) {
        const pk = parsed.storyMediaId.split("_")[0]!;
        const ownerId = parsed.storyMediaId.split("_")[1];
        const fromApi = await fetchMediaInfoByPk(
          pk,
          sessionCookie,
          parsed.normalized,
          ownerId,
          apiMs
        );
        const media = filterValidMedia(fromApi?.media ?? []);
        if (!media.some((m) => m.type === "video" && isCdnMediaUrl(m.url))) return null;
        const extracted = normalizeExtraction(
          {
            ...fromApi!,
            media,
            caption: fromApi!.caption ?? "",
            username: parsed.username ?? fromApi!.username,
          },
          parsed,
          {},
          ""
        );
        return extracted?.media.length ? this.success(extracted) : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  /** Warm cache in background (full extraction, no response budget). */
  prefetch(url: string): Promise<ApiResponse> {
    const validation = validateUrl(url);
    if (!validation.valid) {
      return Promise.resolve(this.error(400, validation.error ?? "Invalid URL"));
    }
    const parsed = parseInstagramUrl(url);
    const cacheKey = parsed.normalized;
    let task = pendingDownloads.get(cacheKey);
    if (!task) {
      task = this.startDownloadTask(cacheKey, parsed);
      pendingDownloads.set(cacheKey, task);
      void task.finally(() => pendingDownloads.delete(cacheKey));
    }
    return task;
  }

  async download(url: string): Promise<ApiResponse> {
    const validation = validateUrl(url);
    if (!validation.valid) {
      return this.error(400, validation.error ?? "Invalid URL");
    }

    const parsed = parseInstagramUrl(url);
    const cacheKey = parsed.normalized;
    const budget = this.options.responseBudgetMs;

    if (this.options.cache !== false) {
      const fresh = this.cache.getFreshSync<ApiResponse>(cacheKey);
      if (fresh) {
        logger.debug(`Cache hit (sync) for ${cacheKey}`);
        return fresh;
      }

      const stale = this.cache.getStaleSync<ApiResponse>(cacheKey);
      if (stale) {
        logger.debug(`Stale cache hit for ${cacheKey}`);
        this.ensureBackgroundFetch(cacheKey, parsed);
        return stale;
      }

      if (!budget) {
        const cached = await this.cache.get<ApiResponse>(cacheKey);
        if (cached) {
          logger.debug(`Cache hit for ${cacheKey}`);
          return cached;
        }
      }
    }

    const inFlight = pendingDownloads.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const task = this.startDownloadTask(cacheKey, parsed);
    pendingDownloads.set(cacheKey, task);
    void task.finally(() => pendingDownloads.delete(cacheKey));

    if (!budget) {
      return task;
    }

    const fastAttempt = this.fetchFastExtract(parsed);
    const raced = await Promise.race([
      fastAttempt,
      task,
      sleep(budget).then(() => null),
    ]);
    if (raced) {
      if (raced.code === 200 && this.options.cache !== false) {
        this.cache.set(cacheKey, raced);
      }
      return raced;
    }

    const retryAfterMs = Math.max(200, Math.min(500, budget));
    return this.error(
      503,
      "Response budget exceeded — fetch still running; retry the same URL immediately",
      retryAfterMs
    );
  }

  private ensureBackgroundFetch(
    cacheKey: string,
    parsed: ReturnType<typeof parseInstagramUrl>
  ): void {
    if (pendingDownloads.has(cacheKey)) return;
    const task = this.startDownloadTask(cacheKey, parsed);
    pendingDownloads.set(cacheKey, task);
    void task.finally(() => pendingDownloads.delete(cacheKey));
  }

  private async fetchAndExtract(
    parsed: ReturnType<typeof parseInstagramUrl>
  ): Promise<ApiResponse> {
    const resolvedUrl = resolveFetchUrl(parsed);

    try {
      let sessionCookie = buildSessionCookie(
        this.options.sessionId,
        this.options.cookies
      );
      let sessionRejected = false;
      const sessionTypes = parsed.type === "story" || parsed.type === "highlight";
      const embedUrl = resolveEmbedUrl(parsed);
      let prefetchApiData: ExtractedPostData | null = null;

      let body = "";
      let statusCode = 200;
      let embedBody = "";

      const ensureSession = async (cookie: string): Promise<string> => {
        if (sessionCookieReady(cookie)) return cookie;
        return enrichSessionCookie(cookie);
      };

      if (sessionCookie) {
        sessionCookie = await ensureSession(sessionCookie);
        const probePk =
          (parsed.shortcode ? shortcodeToMediaPk(parsed.shortcode) : null) ??
          parsed.storyId ??
          null;
        if (probePk && (await isSessionApiRejected(sessionCookie, parsed.normalized, probePk))) {
          logger.debug("Instagram session cookie rejected — continuing logged out");
          sessionRejected = true;
          sessionCookie = undefined;
        }
      }

      // API-first: one round-trip when media/info succeeds (skips heavy page HTML).
      if (sessionCookie && parsed.type === "story" && parsed.storyId) {
        sessionCookie = await ensureSession(sessionCookie);
        const fromApi = await fetchMediaInfoByPk(
          parsed.storyId,
          sessionCookie,
          parsed.normalized,
          userIdFromCookie(sessionCookie) ?? undefined
        );
        const apiMedia = filterValidMedia(fromApi?.media ?? []);
        if (hasStoryVideo(apiMedia)) {
          const extracted = normalizeExtraction(
            {
              ...fromApi!,
              media: apiMedia,
              caption: fromApi!.caption ?? "",
              username: parsed.username ?? fromApi!.username,
            },
            parsed,
            {},
            ""
          );
          if (extracted?.media.length) {
            return this.success(extracted);
          }
        }
        prefetchApiData = fromApi;
      } else if (sessionCookie && parsed.type === "highlight" && parsed.storyMediaId) {
        sessionCookie = await ensureSession(sessionCookie);
        const pk = parsed.storyMediaId.split("_")[0]!;
        const ownerId = parsed.storyMediaId.split("_")[1];
        const [fromApi, pageRes] = await Promise.all([
          fetchMediaInfoByPk(pk, sessionCookie, parsed.normalized, ownerId),
          this.client.fetchWithCookie(resolvedUrl, sessionCookie),
        ]);
        body = pageRes.body;
        statusCode = pageRes.statusCode;
        const apiMedia = filterValidMedia(fromApi?.media ?? []);
        if (apiMedia.some((m) => m.type === "video" && isCdnMediaUrl(m.url))) {
          const pageMeta = extractPageMeta(body);
          const extracted = normalizeExtraction(
            {
              ...fromApi!,
              media: apiMedia,
              caption: fromApi!.caption ?? "",
              username: parsed.username ?? fromApi!.username,
            },
            parsed,
            { ...pageMeta, html: body },
            body
          );
          if (extracted?.media.length) {
            return this.success(extracted);
          }
        }
        prefetchApiData = fromApi;
      } else if (
        sessionCookie &&
        (parsed.type === "post" ||
          parsed.type === "reel" ||
          parsed.type === "tv") &&
        parsed.shortcode
      ) {
        sessionCookie = await ensureSession(sessionCookie);
        const mediaPk = shortcodeToMediaPk(parsed.shortcode);
        const ownerId = userIdFromCookie(sessionCookie) ?? undefined;
        const pagePromise = this.client.fetchWithCookie(resolvedUrl, sessionCookie);
        if (mediaPk) {
          const [fromApi, pageRes] = await Promise.all([
            fetchMediaInfoByPk(mediaPk, sessionCookie, parsed.normalized, ownerId),
            pagePromise,
          ]);
          prefetchApiData = fromApi;
          body = pageRes.body;
          statusCode = pageRes.statusCode;

          if (parsed.type === "reel" || parsed.type === "tv") {
            const apiMedia = filterValidMedia(fromApi?.media ?? []);
            if (hasReelVideo(apiMedia)) {
              const pageMeta = extractPageMeta(body);
              const extracted = normalizeExtraction(
                {
                  ...fromApi!,
                  media: apiMedia,
                  caption: fromApi!.caption ?? "",
                  username: fromApi!.username || "",
                },
                parsed,
                { ...pageMeta, html: body },
                body
              );
              if (extracted?.media.length) {
                return this.success(extracted);
              }
            }
          }
        } else {
          const pageRes = await pagePromise;
          body = pageRes.body;
          statusCode = pageRes.statusCode;
        }
      }

      if (!body) {
        if (sessionCookie && sessionTypes) {
          sessionCookie = await ensureSession(sessionCookie);
          const res = await this.client.fetchWithCookie(resolvedUrl, sessionCookie);
          body = res.body;
          statusCode = res.statusCode;
        } else {
          const res = await this.client.fetch(resolvedUrl);
          body = res.body;
          statusCode = res.statusCode;
        }
      }

      if (statusCode === 404) {
        return this.error(404, "Media not found");
      }

      if (statusCode === 429) {
        return this.error(429, "Rate limited");
      }

      const pageMeta = extractPageMeta(body);
      const ctx = { html: body, url: resolvedUrl, parsed, sessionCookie };

      const prefetchedMedia = prefetchApiData
        ? filterValidMedia(prefetchApiData.media)
        : [];

      let extracted: ExtractedPostData | null;
      if (
        parsed.type === "story" &&
        prefetchedMedia.length &&
        hasStoryVideo(prefetchedMedia)
      ) {
        extracted = {
          ...prefetchApiData!,
          media: prefetchedMedia,
          username: parsed.username ?? prefetchApiData!.username,
        };
      } else {
        extracted = await runExtractor(ctx);
        if (prefetchApiData) {
          extracted = mergeExtracted(extracted, prefetchApiData);
        }
      }

      if (parsed.type === "post" && prefetchApiData) {
        const apiMedia = filterValidMedia(prefetchApiData.media);
        const htmlCount = filterValidMedia(extracted?.media ?? []).length;
        if (apiMedia.length >= 2 || apiMedia.length > htmlCount) {
          extracted = {
            ...(extracted ?? { media: [], caption: "", username: "" }),
            ...prefetchApiData,
            media: apiMedia,
            caption: prefetchApiData.caption || extracted?.caption || "",
            username: prefetchApiData.username || extracted?.username || "",
            engagement: prefetchApiData.engagement ?? extracted?.engagement,
          };
        }
      }

      if (
        (parsed.type === "reel" || parsed.type === "tv") &&
        prefetchApiData &&
        !hasReelVideo(filterValidMedia(extracted?.media ?? []))
      ) {
        const apiMedia = filterValidMedia(prefetchApiData.media);
        if (hasReelVideo(apiMedia)) {
          extracted = {
            ...(extracted ?? { media: [], caption: "", username: "" }),
            ...prefetchApiData,
            media: apiMedia,
            caption: prefetchApiData.caption || extracted?.caption || "",
            username: prefetchApiData.username || extracted?.username || "",
            engagement: prefetchApiData.engagement ?? extracted?.engagement,
          };
        }
      }

      const validExtracted = filterValidMedia(extracted?.media ?? []);
      if (parsed.type === "story" && sessionCookie && !hasStoryVideo(validExtracted)) {
        logger.debug("Trying story API with session cookie");
        const fromApi = await fetchStoryViaSession(parsed, sessionCookie, body);
        extracted = mergeExtracted(extracted, fromApi);
      }

      let embedCaption = "";
      let captionEmbedHtml = "";
      const captionEmbedUrl = contentTypesWithEmbedCaption(parsed.type)
        ? captionedEmbedUrl(parsed)
        : null;

      const enrichmentTasks: Array<Promise<void>> = [];

      if (captionEmbedUrl) {
        enrichmentTasks.push(
          (async () => {
            try {
              const capRes = await this.client.fetch(captionEmbedUrl, false);
              captionEmbedHtml = capRes.body;
              embedCaption = parseCaptionFromCaptionedEmbed(capRes.body, parsed.type);
            } catch {
              /* optional caption source */
            }
          })()
        );
      }

      if (
        parsed.type === "post" &&
        parsed.shortcode &&
        imageNeedsHigherResolution(extracted?.media ?? [])
      ) {
        enrichmentTasks.push(
          (async () => {
            const large = await fetchPostLargeImageUrl(parsed.shortcode!);
            if (large && extracted?.media.length) {
              extracted = {
                ...extracted,
                media: applyLargePostImage(extracted.media, large),
              };
            }
          })()
        );
      }

      if (enrichmentTasks.length) {
        await Promise.all(enrichmentTasks);
      }

      if (
        (parsed.type === "reel" || parsed.type === "tv") &&
        !hasReelVideo(extracted?.media ?? []) &&
        captionEmbedHtml
      ) {
        extracted = mergeExtracted(extracted, parseEmbedHtml(captionEmbedHtml));
      }

      const postHtml = body;
      const carouselHintEarly =
        parsed.type === "post" && htmlIndicatesCarouselPost(postHtml);
      const needPostEmbed =
        parsed.type === "post" &&
        embedUrl &&
        (postNeedsEmbedFetch(extracted?.media ?? []) || carouselHintEarly);
      const needReelEmbed =
        (parsed.type === "reel" || parsed.type === "tv") &&
        embedUrl &&
        needsVideoEmbedFallback(parsed, extracted);

      if (needPostEmbed || needReelEmbed) {
        logger.debug(`Fetching embed: ${embedUrl}`);
        const embedRes = await this.client.fetch(embedUrl!, false);
        embedBody = embedRes.body;
        if (needReelEmbed) {
          const embedData = parseEmbedHtml(embedBody);
          extracted = mergeExtracted(extracted, embedData);
        } else {
          const { parseHtml: parseHtmlLayers } = await import("./parser.js");
          const embedParsed =
            parseEmbedHtml(embedBody) ?? parseHtmlLayers(embedBody, "post");
          extracted = mergeExtracted(extracted, embedParsed);
        }
      }

      const dimensionHtmlPre =
        embedBody || captionEmbedHtml ? `${body}\n${embedBody}\n${captionEmbedHtml}` : body;

      if (
        (parsed.type === "reel" || parsed.type === "tv") &&
        sessionCookie &&
        !hasReelVideo(extracted?.media ?? [])
      ) {
        sessionCookie = await ensureSession(sessionCookie);
        const mediaPk =
          (parsed.shortcode ? shortcodeToMediaPk(parsed.shortcode) : null) ??
          extractMediaPkFromHtml(dimensionHtmlPre);
        if (mediaPk) {
          logger.debug(`Reel API fallback for media pk=${mediaPk}`);
          const fromApi = await fetchMediaInfoByPk(
            mediaPk,
            sessionCookie,
            parsed.normalized,
            userIdFromCookie(sessionCookie) ?? undefined
          );
          extracted = mergeExtracted(extracted, fromApi);
        }
      }

      if (parsed.type === "post" && sessionCookie && parsed.shortcode) {
        sessionCookie = await ensureSession(sessionCookie);
        const htmlSlideCount = extracted?.media.length ?? 0;
        const carouselHint = htmlIndicatesCarouselPost(dimensionHtmlPre);
        const pkCandidates = postMediaPkCandidates(
          parsed.shortcode,
          dimensionHtmlPre,
          extracted?.media ?? []
        );
        let bestApi: ExtractedPostData | null = null;
        for (const mediaPk of pkCandidates) {
          logger.debug(`Post API carousel pk=${mediaPk}`);
          const fromApi = await fetchMediaInfoByPk(
            mediaPk,
            sessionCookie,
            parsed.normalized,
            userIdFromCookie(sessionCookie) ?? undefined
          );
          const apiMedia = filterValidMedia(fromApi?.media ?? []);
          if (
            fromApi &&
            apiMedia.length > (bestApi?.media.length ?? 0)
          ) {
            bestApi = { ...fromApi, media: apiMedia };
          }
        }
        const apiMedia = filterValidMedia(bestApi?.media ?? []);
        const apiImprovesCarousel =
          apiMedia.length >= 2 ||
          apiMedia.length > htmlSlideCount ||
          (carouselHint && apiMedia.length > htmlSlideCount);
        if (bestApi && apiImprovesCarousel) {
          extracted = {
            ...extracted,
            ...bestApi,
            media: apiMedia,
            caption: bestApi.caption || extracted?.caption || "",
            username: bestApi.username || extracted?.username || "",
            engagement: bestApi.engagement ?? extracted?.engagement,
          };
        }
      }

      const storyEmbedUrl = resolveStoryEmbedUrl(parsed);
      if (storyEmbedUrl && parsed.type === "story" && !hasStoryVideo(extracted?.media ?? [])) {
        logger.debug(`Fetching story embed: ${storyEmbedUrl}`);
        const storyEmbedRes = await this.client.fetch(storyEmbedUrl, false);
        const storyEmbedData = parseEmbedHtml(storyEmbedRes.body);
        extracted = mergeExtracted(extracted, storyEmbedData);
        if (!extracted?.media.some((m) => m.type === "video")) {
          const { parseHtml } = await import("./parser.js");
          extracted = mergeExtracted(extracted, parseHtml(storyEmbedRes.body));
        }
      }

      const dimensionHtml = dimensionHtmlPre;
      extracted = normalizeExtraction(
        extracted,
        parsed,
        { ...pageMeta, html: dimensionHtml, embedCaption },
        dimensionHtml
      );

      if (extracted && parsed.type === "post") {
        const contentTags = buildPostContentTags(
          parsed.type,
          extracted.media.length,
          dimensionHtml,
          Boolean(sessionCookie)
        );
        extracted = {
          ...extracted,
          tags: mergeResultTags(extracted.tags, contentTags),
        };
      }

      if (extracted?.media.length) {
        extracted = {
          ...extracted,
          media: extracted.media.map((m) => {
            if (m.type !== "video" || isValidThumbnailUrl(m.thumbnail)) return m;
            const { thumbnail: _t, ...rest } = m;
            return rest;
          }),
        };
      }

      if (extracted?.isPrivate) {
        return this.error(403, "Private account");
      }

      if (!extracted?.media.length) {
        const msg =
          parsed.type === "story"
            ? sessionCookie
              ? "Story not found or expired (check sessionId and that the story is still active)"
              : "Story media requires sessionId — Instagram does not expose story CDN URLs to logged-out requests. Pass options.sessionId from a logged-in browser cookie."
            : parsed.type === "reel" || parsed.type === "tv"
              ? sessionRejected
                ? "Reel video not found — your Instagram session cookie is expired or invalid. Copy fresh sessionid, csrftoken, and ds_user_id from a logged-in browser."
                : sessionCookie
                  ? "Reel video not found — reel may be unavailable or session expired"
                  : "Reel video requires INSTAGRAM_SESSION_ID or INSTAGRAM_COOKIES — Instagram no longer exposes reel MP4 URLs in public HTML"
              : "Media not found";
        return this.error(404, msg);
      }

      return this.success(extracted);
    } catch (err: unknown) {
      const code =
        (err as { code?: number })?.code ??
        (err as { statusCode?: number })?.statusCode;
      if (code === 429) return this.error(429, "Rate limited");
      if (err instanceof Error && err.name === "AbortError") {
        return this.error(504, "Request timed out");
      }
      logger.error("Extraction failed", err);
      return this.error(500, err instanceof Error ? err.message : "Extraction failed");
    }
  }

  async info(url: string): Promise<ApiResponse> {
    return this.download(url);
  }

  async validate(url: string): Promise<{ valid: boolean; type?: string; normalized?: string }> {
    return validateUrl(url);
  }

  async media(url: string): Promise<Media[] | ErrorResponse> {
    const result = await this.download(url);
    if (result.code !== 200) return result as ErrorResponse;
    return (result as DownloadResponse).media;
  }

  async batch(urls: string[]): Promise<BatchResult[]> {
    const tasks = urls.map(async (url) => {
      const start = Date.now();
      const result = await this.download(url);
      return { url, result, durationMs: Date.now() - start };
    });
    return Promise.all(tasks);
  }

  async health(): Promise<HealthStatus> {
    const stats = this.cache.getStats();
    const pool = getPoolStats();
    return {
      status: "ok",
      version: PACKAGE_VERSION,
      uptime: Date.now() - this.startTime,
      cache: {
        size: stats.size,
        maxSize: stats.maxSize,
        hitRate: stats.hitRate,
      },
      pool: {
        connections: pool.connections,
        pending: this.client.getInFlightCount(),
      },
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}