import type { ExtractedPostData, Media, ParsedUrl } from "../types/index.js";
import { decodeEscapedUrl, parseHtml } from "../core/parser.js";
import { extractCaptionFromApiItem } from "../utils/caption.js";
import { engagementFromApiItem } from "../utils/engagement-tags.js";
import { buildApiHeaders, buildInstagramPageHeaders } from "./headers.js";
import { request } from "./request.js";
import { logger } from "../utils/logger.js";
import { isCdnMediaUrl, isStoryProfileImage } from "../utils/media-quality.js";

const IG_APP_ID = "936619743392459";
const API_HOSTS = ["https://www.instagram.com", "https://i.instagram.com"] as const;

export function normalizeSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export function buildSessionCookie(sessionId?: string, cookies?: string): string | undefined {
  if (cookies?.trim()) {
    const map = new Map<string, string>();
    for (const part of cookies.trim().split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k) map.set(k.trim(), rest.join("=").trim());
    }
    if (map.has("sessionid")) {
      map.set("sessionid", normalizeSessionId(map.get("sessionid")!));
    }
    return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  if (sessionId?.trim()) return `sessionid=${normalizeSessionId(sessionId)}`;
  return undefined;
}

function mergeSetCookie(existing: string, setCookieHeader: string | string[] | undefined): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k) map.set(k.trim(), rest.join("=").trim());
  }
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  for (const h of headers) {
    const first = h.split(";")[0]!;
    const eq = first.indexOf("=");
    if (eq > 0) map.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export function userIdFromCookie(sessionCookie: string): string | null {
  const id = sessionCookie.match(/ds_user_id=([^;]+)/)?.[1];
  return id && /^\d+$/.test(id) ? id : null;
}

/** Add csrftoken/ds_user_id from Instagram when only sessionid is known. */
export function sessionCookieReady(cookie: string): boolean {
  return cookie.includes("csrftoken=") && cookie.includes("ds_user_id=");
}

export async function enrichSessionCookie(cookie: string): Promise<string> {
  if (sessionCookieReady(cookie)) return cookie;
  const res = await request("https://www.instagram.com/", {
    headers: {
      ...buildInstagramPageHeaders(),
      Cookie: cookie,
    },
  });
  await res.body.text();
  return mergeSetCookie(cookie, res.headers["set-cookie"]);
}

function parseCsrfFromCookie(cookie: string): string {
  return cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
}

function mediaFromStoryItem(item: Record<string, unknown>): Media[] {
  const media: Media[] = [];
  const isVideo = item.media_type === 2 || item.is_video === true;

  if (isVideo && Array.isArray(item.video_versions)) {
    const versions = item.video_versions as Array<Record<string, unknown>>;
    const best = versions.reduce((a, b) =>
      ((b.width as number) ?? 0) > ((a.width as number) ?? 0) ? b : a
    );
    if (typeof best.url === "string") {
      media.push({
        type: "video",
        url: decodeEscapedUrl(best.url),
        width: best.width as number | undefined,
        height: best.height as number | undefined,
        duration: item.video_duration as number | undefined,
      });
    }
  }

  const candidates = (item.image_versions2 as Record<string, unknown> | undefined)
    ?.candidates as Array<Record<string, unknown>> | undefined;
  if (candidates?.length) {
    const best = candidates.reduce((a, b) =>
      ((b.width as number) ?? 0) > ((a.width as number) ?? 0) ? b : a
    );
    if (typeof best.url === "string") {
      const image = {
        type: "image" as const,
        url: decodeEscapedUrl(best.url),
        width:
          (best.width as number | undefined) ??
          (item.original_width as number | undefined),
        height:
          (best.height as number | undefined) ??
          (item.original_height as number | undefined),
      };
      if (!media.length || !isVideo) media.push(image);
      else if (media[0] && !media[0].thumbnail) media[0].thumbnail = image.url;
    }
  }

  return media;
}

function mediaFromApiItem(item: Record<string, unknown>): Media[] {
  const carousel = item.carousel_media as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(carousel) && carousel.length > 0) {
    const media: Media[] = [];
    for (const slide of carousel) {
      if (slide && typeof slide === "object") {
        media.push(...mediaFromStoryItem(slide));
      }
    }
    return media;
  }
  return mediaFromStoryItem(item);
}

const API_TIMEOUT_MS = 6_000;

async function igApiGet(
  path: string,
  sessionCookie: string,
  referer: string,
  host: (typeof API_HOSTS)[number] = API_HOSTS[0],
  timeoutMs = API_TIMEOUT_MS
): Promise<{ statusCode: number; body: string }> {
  const csrf = parseCsrfFromCookie(sessionCookie);
  const headers = {
    ...buildApiHeaders(),
    Cookie: sessionCookie,
    Referer: referer,
    "X-CSRFToken": csrf,
    "X-IG-App-ID": IG_APP_ID,
  };

  const url = path.startsWith("http") ? path : `${host}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const body = await response.body.text();
    return { statusCode: response.statusCode, body };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStoryPageWithSession(
  url: string,
  sessionCookie: string
): Promise<{ statusCode: number; body: string }> {
  const response = await request(url, {
    headers: {
      ...buildInstagramPageHeaders(),
      Cookie: sessionCookie,
    },
  });
  const body = await response.body.text();
  return { statusCode: response.statusCode, body };
}

export function extractStoryMediaFromHtml(html: string, storyId?: string): Media[] {
  const media: Media[] = [];
  const seen = new Set<string>();

  const add = (item: Media) => {
    if (isStoryProfileImage(item.url)) return;
    const key = item.url.split("?")[0]!;
    if (seen.has(key)) return;
    seen.add(key);
    media.push(item);
  };

  if (storyId) {
    let pos = 0;
    while ((pos = html.indexOf(storyId, pos)) !== -1) {
      const chunk = html.slice(Math.max(0, pos - 12000), pos + 16000);
      collectFromChunk(chunk, add);
      pos += storyId.length;
    }
  }

  collectFromChunk(html, add);
  return media;
}

function collectFromChunk(chunk: string, add: (m: Media) => void): void {
  const patterns = [
    /"video_versions":\s*\[[^\]]*?"url":\s*"([^"]+)"/g,
    /video_url\\":\\"([^"]+)/g,
    /"playback_url":"(https?:[^"]+)"/g,
    /"url":"(https?:\\\/\\\/[^"]*?fbcdn[^"]+)"/g,
    /"url":"(https?:\\\/\\\/[^"]*?cdninstagram[^"]+)"/g,
  ];

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(chunk)) !== null) {
      let url = decodeEscapedUrl(m[1]!);
      if (!url.startsWith("http")) url = `https://${url.replace(/^\/+/, "")}`;
      if (url.includes(".mp4") || url.includes("video")) {
        add({ type: "video", url });
      } else if (url.includes("cdninstagram") || url.includes("fbcdn")) {
        add({ type: "image", url });
      }
    }
  }
}

export async function fetchUserId(
  username: string,
  sessionCookie: string,
  referer: string
): Promise<string | null> {
  const fromCookie = userIdFromCookie(sessionCookie);
  if (fromCookie) return fromCookie;

  for (const host of API_HOSTS) {
    const { statusCode, body } = await igApiGet(
      `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      sessionCookie,
      referer,
      host
    );
    if (statusCode === 429) break;
    if (statusCode !== 200) continue;
    try {
      const data = JSON.parse(body) as Record<string, unknown>;
      const user = (data.data as Record<string, unknown> | undefined)?.user as
        | Record<string, unknown>
        | undefined;
      const id = user?.id ?? user?.pk;
      if (id != null) return String(id);
    } catch {
      const m = body.match(/"id":"(\d+)"/);
      if (m) return m[1]!;
    }
  }
  return null;
}

function storyItemMatches(item: Record<string, unknown>, storyPk: string): boolean {
  const ids = [item.pk, item.id, item.media_id, item.story_media_id, item.fbid, item.code].map(
    (v) => (v != null ? String(v) : "")
  );
  return ids.some(
    (id) =>
      id === storyPk ||
      id.startsWith(`${storyPk}_`) ||
      storyPk.startsWith(`${id}_`) ||
      id.includes(storyPk)
  );
}

function parseMediaInfoBody(body: string): ExtractedPostData | null {
  try {
    const payload = JSON.parse(body) as Record<string, unknown>;
    const items = payload.items as Array<Record<string, unknown>> | undefined;
    const item = items?.[0] ?? payload;
    if (!item || typeof item !== "object") return null;
    const media = mediaFromApiItem(item as Record<string, unknown>);
    if (!media.length) return null;
    const user = (item as Record<string, unknown>).user as Record<string, unknown> | undefined;
    return {
      media,
      caption: extractCaptionFromApiItem(item as Record<string, unknown>),
      username: typeof user?.username === "string" ? user.username : "",
      engagement: engagementFromApiItem(item as Record<string, unknown>),
    };
  } catch {
    return null;
  }
}

async function fetchMediaInfoOnce(
  id: string,
  sessionCookie: string,
  referer: string,
  host: (typeof API_HOSTS)[number],
  timeoutMs?: number
): Promise<ExtractedPostData | null> {
  const { statusCode, body } = await igApiGet(
    `/api/v1/media/${id}/info/?media_id=${id}`,
    sessionCookie,
    referer,
    host,
    timeoutMs ?? API_TIMEOUT_MS
  );
  if (statusCode !== 200) {
    logger.debug(`media info ${statusCode} ${host} id=${id}`);
    return null;
  }
  const parsed = parseMediaInfoBody(body);
  return parsed?.media.length ? parsed : null;
}

/** Return on first successful media/info response (parallel hosts/ids). */
export async function fetchMediaInfoByPk(
  mediaPk: string,
  sessionCookie: string,
  referer: string,
  ownerUserId?: string | null,
  timeoutMs?: number
): Promise<ExtractedPostData | null> {
  const ids = ownerUserId ? [mediaPk, `${mediaPk}_${ownerUserId}`] : [mediaPk];
  const perAttempt = timeoutMs ?? API_TIMEOUT_MS;

  const attempts: Array<Promise<ExtractedPostData>> = [];
  for (const host of API_HOSTS) {
    for (const id of ids) {
      attempts.push(
        fetchMediaInfoOnce(id, sessionCookie, referer, host, perAttempt).then((r) => {
          if (!r?.media.length) throw new Error("miss");
          return r;
        })
      );
    }
  }

  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

async function fetchUserStoryFeed(
  userId: string,
  sessionCookie: string,
  referer: string,
  storyPk?: string
): Promise<ExtractedPostData | null> {
  for (const host of API_HOSTS) {
    const { statusCode, body } = await igApiGet(
      `/api/v1/feed/user/${userId}/story/`,
      sessionCookie,
      referer,
      host
    );
    if (statusCode !== 200) {
      logger.debug(`user story feed ${statusCode} ${host}`);
      continue;
    }
    try {
      const payload = JSON.parse(body) as Record<string, unknown>;
      const reel = payload.reel as Record<string, unknown> | undefined;
      const items = (reel?.items ?? payload.items) as Array<Record<string, unknown>> | undefined;
      if (!items?.length) continue;

      const item =
        (storyPk ? items.find((i) => storyItemMatches(i, storyPk)) : undefined) ?? items[0];
      const media = mediaFromStoryItem(item);
      if (!media.length) continue;
      return { media, caption: "", username: "" };
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchReelsMedia(
  userId: string,
  sessionCookie: string,
  referer: string,
  storyPk?: string
): Promise<ExtractedPostData | null> {
  for (const host of API_HOSTS) {
    const { statusCode, body } = await igApiGet(
      `/api/v1/feed/reels_media/?reel_ids=${userId}`,
      sessionCookie,
      referer,
      host
    );
    if (statusCode !== 200) {
      logger.debug(`reels_media ${statusCode} ${host}`);
      continue;
    }
    try {
      const payload = JSON.parse(body) as Record<string, unknown>;
      const reels = payload.reels as Record<string, unknown> | undefined;
      const reel = (reels?.[userId] ?? Object.values(reels ?? {})[0]) as
        | Record<string, unknown>
        | undefined;
      const items = reel?.items as Array<Record<string, unknown>> | undefined;
      if (!items?.length) continue;

      const item =
        (storyPk ? items.find((i) => storyItemMatches(i, storyPk)) : undefined) ?? items[0];
      const media = mediaFromStoryItem(item);
      if (!media.length) continue;
      return { media, caption: "", username: "" };
    } catch {
      continue;
    }
  }
  return null;
}

function storyMediaFromPageHtml(
  html: string,
  storyPk?: string
): ExtractedPostData | null {
  const fromHtml = extractStoryMediaFromHtml(html, storyPk);
  const videos = fromHtml.filter((m) => m.type === "video" && isCdnMediaUrl(m.url));
  if (videos.length) {
    return { media: videos, caption: "", username: "" };
  }

  const parsedHtml = parseHtml(html, "story");
  const ogMedia =
    parsedHtml?.media.filter(
      (m) =>
        !isStoryProfileImage(m.url) &&
        (m.type === "video" ? isCdnMediaUrl(m.url) : true)
    ) ?? [];
  if (ogMedia.length) {
    return { media: ogMedia, caption: "", username: "" };
  }
  return null;
}

export async function fetchStoryViaSession(
  parsed: ParsedUrl,
  sessionCookie: string,
  existingPageHtml?: string
): Promise<ExtractedPostData | null> {
  if (!parsed.username) return null;

  const referer = parsed.normalized;
  const storyPk = parsed.storyId;
  const ownerUserId = userIdFromCookie(sessionCookie);

  if (storyPk) {
    const direct = await fetchMediaInfoByPk(
      storyPk,
      sessionCookie,
      referer,
      ownerUserId ?? undefined
    );
    if (direct?.media.length) {
      return { ...direct, username: parsed.username };
    }
  }

  if (existingPageHtml) {
    const fromPage = storyMediaFromPageHtml(existingPageHtml, storyPk);
    if (fromPage?.media.length) {
      return { ...fromPage, username: parsed.username };
    }
  }

  if (!existingPageHtml) {
    const authPage = await fetchStoryPageWithSession(referer, sessionCookie);
    if (authPage.statusCode === 200) {
      const fromPage = storyMediaFromPageHtml(authPage.body, storyPk);
      if (fromPage?.media.length) {
        return { ...fromPage, username: parsed.username };
      }
    }
  }

  const userId =
    ownerUserId ?? (await fetchUserId(parsed.username, sessionCookie, referer));
  if (!userId) return null;

  const feed = await fetchUserStoryFeed(userId, sessionCookie, referer, storyPk);
  if (feed?.media.length) {
    return { ...feed, username: parsed.username };
  }

  const reels = await fetchReelsMedia(userId, sessionCookie, referer, storyPk);
  if (reels?.media.length) {
    return { ...reels, username: parsed.username };
  }

  if (storyPk) {
    const retry = await fetchMediaInfoByPk(storyPk, sessionCookie, referer, userId);
    if (retry?.media.length) {
      return { ...retry, username: parsed.username };
    }
  }

  return null;
}