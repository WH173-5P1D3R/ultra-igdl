const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
];

const ACCEPT_LANGUAGES = [
  "en-US,en;q=0.9",
  "en-GB,en;q=0.9",
  "en-US,en;q=0.8,es;q=0.6",
];

const SEC_CH_UA = [
  '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  '"Chromium";v="131", "Not_A Brand";v="24"',
];

let rotationIndex = 0;

export function rotateIndex(max: number): number {
  const idx = rotationIndex % max;
  rotationIndex += 1;
  return idx;
}

const MOBILE_UA = USER_AGENTS[5]!;

/** Instagram serves richer OG/media markup to mobile Safari user agents. */
export function buildInstagramPageHeaders(_rotate = false): Record<string, string> {
  const ua = MOBILE_UA;
  return {
    "User-Agent": ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    // Do not request br — undici/IG combo returns stripped HTML without OG tags.
    Referer: "https://www.instagram.com/",
  };
}

export function buildHeaders(url: string, rotate = true): Record<string, string> {
  if (url.includes("instagram.com") && !url.includes("cdninstagram") && !url.includes("fbcdn")) {
    return buildInstagramPageHeaders(rotate);
  }

  const uaIdx = rotate ? rotateIndex(USER_AGENTS.length) : 0;
  const langIdx = rotate ? rotateIndex(ACCEPT_LANGUAGES.length) : 0;
  const secIdx = rotate ? rotateIndex(SEC_CH_UA.length) : 0;

  return {
    "User-Agent": USER_AGENTS[uaIdx]!,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": ACCEPT_LANGUAGES[langIdx]!,
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Ch-Ua": SEC_CH_UA[secIdx]!,
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    Referer: "https://www.instagram.com/",
    Origin: "https://www.instagram.com",
    ...(url.includes("cdninstagram") || url.includes("fbcdn")
      ? { Referer: "https://www.instagram.com/" }
      : {}),
  };
}

/** Headers for downloading signed CDN media (fbcdn / scontent). */
export function buildCdnDownloadHeaders(url: string): Record<string, string> {
  return {
    "User-Agent": MOBILE_UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.instagram.com/",
    Origin: "https://www.instagram.com",
    "Sec-Fetch-Dest": url.includes(".mp4") ? "video" : "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
  };
}

export function buildApiHeaders(): Record<string, string> {
  const base = buildHeaders("https://www.instagram.com/");
  return {
    ...base,
    "X-Requested-With": "XMLHttpRequest",
    "X-IG-App-ID": "936619743392459",
    "X-ASBD-ID": "129477",
    Accept: "*/*",
  };
}