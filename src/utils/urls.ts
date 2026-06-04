import type { ParsedUrl } from "../types/index.js";

const IG_HOST = /^(?:www\.)?instagram\.com$/i;

function decodeShareSlug(slug: string): { type: "highlight"; id: string } | null {
  try {
    const decoded = Buffer.from(slug, "base64").toString("utf8");
    const match = decoded.match(/^highlight:(\d+)$/);
    if (match) return { type: "highlight", id: match[1]! };
  } catch {
    return null;
  }
  return null;
}

function buildNormalizedPath(pathname: string): string {
  let path = pathname.replace(/\/+$/, "");
  if (!path.endsWith("/")) path += "/";
  return `https://www.instagram.com${path}`;
}

export function normalizeInstagramUrl(input: string): string {
  return parseInstagramUrl(input).normalized;
}

export function parseInstagramUrl(input: string): ParsedUrl {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) {
    const pathOnly = !raw.includes("instagram.com");
    raw = pathOnly
      ? `https://www.instagram.com/${raw.replace(/^\//, "")}`
      : `https://${raw.replace(/^\//, "")}`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { type: "unknown", normalized: raw };
  }

  if (!IG_HOST.test(url.hostname)) {
    return { type: "unknown", normalized: raw };
  }

  const storyMediaId = url.searchParams.get("story_media_id") ?? undefined;
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts[0] === "s" && parts[1]) {
    const share = decodeShareSlug(parts[1]);
    if (share?.type === "highlight") {
      return {
        type: "highlight",
        highlightId: share.id,
        storyMediaId,
        normalized: buildNormalizedPath(`/stories/highlights/${share.id}`),
      };
    }
  }

  if (parts[0] === "reel" && parts[1]) {
    return {
      type: "reel",
      shortcode: parts[1],
      normalized: buildNormalizedPath(`/reel/${parts[1]}`),
    };
  }

  if (parts[0] === "p" && parts[1]) {
    return {
      type: "post",
      shortcode: parts[1],
      normalized: buildNormalizedPath(`/p/${parts[1]}`),
    };
  }

  if (parts[0] === "tv" && parts[1]) {
    return {
      type: "tv",
      shortcode: parts[1],
      normalized: buildNormalizedPath(`/tv/${parts[1]}`),
    };
  }

  if (parts[0] === "stories" && parts[1]) {
    if (parts[1] === "highlights" && parts[2]) {
      return {
        type: "highlight",
        highlightId: parts[2],
        storyMediaId,
        normalized: buildNormalizedPath(`/stories/highlights/${parts[2]}`),
      };
    }
    if (parts[2]) {
      return {
        type: "story",
        username: parts[1],
        storyId: parts[2],
        normalized: buildNormalizedPath(`/stories/${parts[1]}/${parts[2]}`),
      };
    }
    return {
      type: "story",
      username: parts[1],
      normalized: buildNormalizedPath(`/stories/${parts[1]}`),
    };
  }

  return { type: "unknown", normalized: buildNormalizedPath(url.pathname || "/") };
}

export function isInstagramUrl(input: string): boolean {
  try {
    const normalized = normalizeInstagramUrl(
      input.startsWith("http") ? input : `https://${input}`
    );
    const parsed = parseInstagramUrl(normalized);
    return parsed.type !== "unknown";
  } catch {
    return false;
  }
}

export function shortcodeToMediaUrl(shortcode: string, type: "reel" | "post" | "tv" = "post"): string {
  const segment = type === "reel" ? "reel" : type === "tv" ? "tv" : "p";
  return `https://www.instagram.com/${segment}/${shortcode}/`;
}