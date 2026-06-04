/** Instagram numeric media PK from page or embed HTML. */
export function extractMediaPkFromHtml(html: string): string | null {
  if (!html) return null;

  const cacheKey = html.match(/ig_cache_key=([A-Za-z0-9%_+=]+)/i)?.[1];
  if (cacheKey) {
    try {
      const decoded = Buffer.from(
        decodeURIComponent(cacheKey.replace(/ /g, "+")),
        "base64"
      ).toString("utf8");
      if (/^\d{10,}$/.test(decoded)) return decoded;
    } catch {
      /* ignore */
    }
  }

  const patterns = [
    /data-media-id="(\d+)"/,
    /data-media-id\\":\\"(\d+)\\"/,
    /"media_id":"(\d+)"/,
    /"pk":"(\d+)"/,
    /"pk":"(\d+)"[^}]{0,120}"media_type":\s*2/,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}