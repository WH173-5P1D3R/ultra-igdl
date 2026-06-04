# ultra-igdl

**Production-grade Instagram media extractor for Node.js 18+**

Fetch direct CDN URLs for reels, posts, carousels, stories, and highlights. Built from scratch with a multi-layer HTML/JSON parser, optional logged-in session API, connection pooling, LRU cache, and a CLI — **no wrapper around other Instagram downloader packages**.

---

## Table of contents

1. [Who is this for?](#who-is-this-for)
2. [Requirements](#requirements)
3. [Installation](#installation)
4. [Quick start (beginner)](#quick-start-beginner)
5. [Instagram session (important)](#instagram-session-important)
6. [CLI guide](#cli-guide)
7. [Supported URLs](#supported-urls)
8. [Response format](#response-format)
9. [Content types explained](#content-types-explained)
10. [JavaScript / TypeScript API](#javascript--typescript-api)
11. [Configuration options](#configuration-options)
12. [Pro features](#pro-features)
13. [Error codes & troubleshooting](#error-codes--troubleshooting)
14. [Examples in this repo](#examples-in-this-repo)
15. [Architecture](#architecture)
16. [Development](#development)
17. [Publishing to npm](#publishing-to-npm)
18. [Legal & disclaimer](#legal--disclaimer)
19. [License](#license)

---

## Who is this for?

| Level | You can… |
|--------|-----------|
| **Beginner** | Install with npm, run `npx ultra-igdl <url> --json`, paste a browser cookie for full carousels |
| **Intermediate** | Use `ultraigdl` in Express/Fastify bots, batch URLs, download files with `--download` |
| **Pro** | Tune cache/Redis, `fastMode` + `prefetch`, `maxConcurrency`, integrate `DownloaderCore` |

---

## Requirements

- **Node.js** 18, 20, or 22 (LTS recommended)
- **npm** 9+ (or pnpm/yarn)
- Public Instagram URLs (no login required for basic post/reel preview)
- **Optional:** Instagram `sessionid` cookie for carousels (all slides), reel MP4, stories, highlights

---

## Installation

```bash
npm install ultra-igdl
```

CLI only (no install into project):

```bash
npx ultra-igdl --help
```

---

## Quick start (beginner)

### 1. Programmatic (ESM)

```js
import { ultraigdl } from "ultra-igdl";

const ig = new ultraigdl();
const result = await ig.download("https://www.instagram.com/reel/SHORTCODE/");

if (result.code === 200) {
  console.log("User:", result.username);
  console.log("Caption:", result.caption);
  console.log("Files:", result.media.length);
  result.media.forEach((m, i) => console.log(i + 1, m.type, m.url));
} else {
  console.error(result.code, result.message);
}
```

### 2. CommonJS

```js
const { ultraigdl } = require("ultra-igdl");

(async () => {
  const ig = new ultraigdl();
  const result = await ig.download("https://www.instagram.com/p/SHORTCODE/");
  console.log(result);
})();
```

### 3. CLI (JSON)

```bash
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

On **Windows PowerShell**, always wrap URLs in **double quotes** (see [CLI guide](#cli-guide)).

---

## Instagram session (important)

Instagram limits what **logged-out** visitors see:

| Feature | Without session | With session (`sessionId` / `cookies`) |
|---------|-----------------|----------------------------------------|
| Single post image | Usually yes | Yes (full resolution) |
| **Carousel (2+ photos)** | Often **1 slide only** | **All slides** |
| **Reel MP4** | Often thumbnail only | **Video URL** |
| **Story** | Usually fails / preview | **Media URL** |
| **Highlight** | Limited | **Video** when available |

### How to get cookies (browser)

1. Log in to [instagram.com](https://www.instagram.com) in Chrome/Edge/Firefox.
2. Open DevTools → **Application** → **Cookies** → `https://www.instagram.com`.
3. Copy:
   - `sessionid`
   - `csrftoken`
   - `ds_user_id`

### Option A — full cookie string (recommended)

```js
const ig = new ultraigdl({
  cookies:
    "sessionid=YOUR_ID; csrftoken=YOUR_CSRF; ds_user_id=YOUR_USER_ID",
});
```

### Option B — session id only

```js
const ig = new ultraigdl({
  sessionId: "YOUR_SESSIONID_VALUE",
});
```

### Environment variables (CLI)

The CLI auto-loads `.env` from the current directory or `../ultra-igdl-live-test/.env`.

```bash
# Linux / macOS
export INSTAGRAM_COOKIES="sessionid=...; csrftoken=...; ds_user_id=..."
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

```powershell
# Windows PowerShell — use TWO lines, or semicolon before npx
$env:INSTAGRAM_COOKIES = "sessionid=...; csrftoken=...; ds_user_id=..."
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

**Never commit real cookies to git.** Add `.env` to `.gitignore` (already included).

---

## CLI guide

```bash
npx ultra-igdl <url> [options]
npx ultra-igdl urls.txt          # one URL per line
```

| Flag | Short | Description |
|------|-------|-------------|
| `--json` | `-j` | Print full API response as JSON |
| `--download` | `-d` | Save media files under `--output` |
| `--output <dir>` | `-o` | Download folder (default: `./downloads`) |
| `--verbose` | `-v` | Debug logging |
| `--help` | `-h` | Show help |

### PowerShell rules

1. Wrap URLs in `"quotes"` when the link contains `&` (e.g. `?igsh=...&...`).
2. Set env vars on **line 1**, run `npx` on **line 2**, **or** use `;` between them:

```powershell
$env:INSTAGRAM_COOKIES = "sessionid=...; csrftoken=...; ds_user_id=..."; npx ultra-igdl "https://www.instagram.com/p/ABC/" --json
```

### CLI examples

```bash
# Human-readable summary
npx ultra-igdl "https://www.instagram.com/reel/ABC123/"

# JSON for scripts
npx ultra-igdl "https://www.instagram.com/p/ABC123/" --json

# Download all carousel images
npx ultra-igdl "https://www.instagram.com/p/ABC123/" --download -o ./downloads

# Batch file (urls.txt)
npx ultra-igdl urls.txt --json
```

---

## Supported URLs

| Type | Example pattern |
|------|-----------------|
| Post | `https://www.instagram.com/p/{shortcode}/` |
| Reel | `https://www.instagram.com/reel/{shortcode}/` |
| IGTV | `https://www.instagram.com/tv/{shortcode}/` |
| Story | `https://www.instagram.com/stories/{username}/{storyId}/` |
| Highlight (path) | `https://www.instagram.com/stories/highlights/{id}/` |
| Highlight (share) | `https://www.instagram.com/s/{token}?story_media_id=...` |

Validate before download:

```js
const { valid, type, normalized } = await ig.validate(url);
```

---

## Response format

### Success (`code: 200`)

```json
{
  "code": 200,
  "meta": { "extractor": "ultra-igdl", "version": "1.0.0" },
  "media": [
    {
      "type": "image",
      "url": "https://...cdninstagram.../....jpg",
      "width": 1440,
      "height": 1800
    },
    {
      "type": "video",
      "url": "https://...mp4",
      "thumbnail": "https://...jpg",
      "width": 1080,
      "height": 1920,
      "duration": 24
    }
  ],
  "caption": "Post caption as a single clean line for posts",
  "username": "creator",
  "engagement": {
    "likes": 1200,
    "comments": 45
  },
  "tags": ["carousel"]
}
```

### Media object

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"image"` \| `"video"` | Primary media type |
| `url` | `string` | Direct CDN URL (signed; do not edit query params) |
| `thumbnail` | `string?` | Poster frame for video |
| `width` / `height` | `number?` | Pixel dimensions when known |
| `duration` | `number?` | Video length in seconds |

### Tags (`tags` array)

| Tag | Meaning |
|-----|---------|
| `carousel` | Multi-slide post; `media.length` ≥ 2 |
| `partial_carousel` | Carousel detected but only one slide returned |
| `session_recommended` | Add `sessionId` / `cookies` for full carousel |
| `likes_hidden` | Creator hid like counts |
| `comments_hidden` | Comments disabled or hidden |
| `engagement_hidden` | Both likes and comments hidden |

### Error (`code` ≠ 200)

```json
{
  "code": 404,
  "message": "Media not found",
  "meta": { "extractor": "ultra-igdl", "version": "1.0.0" }
}
```

Some responses include `retryAfterMs` when using `fastMode` / `responseBudgetMs` (background fetch still running).

---

## Content types explained

### Posts (single image)

```js
const result = await ig.download("https://www.instagram.com/p/SHORTCODE/");
// result.media.length === 1 typically
```

### Carousels (2+ photos)

- **Auto-detected** from any `/p/` URL — no special URL or env var.
- Without session: often 1 image + tags `partial_carousel`, `session_recommended`.
- With session: all slides, tag `carousel`.

```js
const ig = new ultraigdl({ cookies: process.env.INSTAGRAM_COOKIES });
const result = await ig.download("https://www.instagram.com/p/SHORTCODE/");
console.log(result.media.length); // e.g. 4
console.log(result.tags);         // ["carousel"]
```

### Reels

```js
const ig = new ultraigdl({ sessionId: process.env.INSTAGRAM_SESSION_ID });
const result = await ig.download("https://www.instagram.com/reel/SHORTCODE/");
const video = result.media.find((m) => m.type === "video");
```

### Stories

Requires session. Story must still be live (not expired).

```js
const result = await ig.download(
  "https://www.instagram.com/stories/username/1234567890/"
);
```

### Highlights

Works with highlight URLs or `/s/` share links; session improves reliability.

---

## JavaScript / TypeScript API

```ts
import { ultraigdl, type ApiResponse, type DownloadResponse } from "ultra-igdl";

const ig = new ultraigdl({ cache: true, retries: 2 });
```

| Method | Returns | Description |
|--------|---------|-------------|
| `download(url)` | `Promise<ApiResponse>` | Full extraction (main method) |
| `info(url)` | `Promise<ApiResponse>` | Alias of `download` |
| `validate(url)` | `Promise<{ valid, type?, normalized? }>` | URL check + normalization |
| `media(url)` | `Promise<Media[] \| ErrorResponse>` | Media array only |
| `batch(urls)` | `Promise<BatchResult[]>` | Parallel downloads with per-URL timing |
| `prefetch(url)` | `Promise<ApiResponse>` | Warm cache for `fastMode` |
| `health()` | `Promise<HealthStatus>` | Cache stats, pool, version |
| `clearCache()` | `void` | Clear in-memory LRU cache |

### TypeScript

Types are shipped in `dist/index.d.ts`. Narrow success responses:

```ts
const result = await ig.download(url);
if (result.code === 200) {
  const data = result as DownloadResponse;
  data.media.forEach((m) => { /* ... */ });
}
```

### Helpers (also exported)

```ts
import { validateUrl, parseInstagramUrl, isInstagramUrl } from "ultra-igdl";
```

---

## Configuration options

```ts
const ig = new ultraigdl({
  // Cache
  cache: true,              // default: true
  cacheTtlMs: 300_000,      // 5 min fresh TTL
  staleCacheTtlMs: 86_400_000, // 24h stale-while-revalidate
  cacheMaxSize: 500,

  // Network
  maxConcurrency: 100,
  timeoutMs: 15_000,
  retries: 3,
  userAgentRotation: true,

  // Session
  sessionId: "...",
  cookies: "sessionid=...; csrftoken=...; ds_user_id=...",

  // Low-latency mode (bots that reply in <500ms)
  fastMode: true,           // sets responseBudgetMs: 500, retries: 0
  responseBudgetMs: 800,

  // Optional Redis (implement RedisAdapter interface)
  redis: myRedisAdapter,

  verbose: false,
});
```

---

## Pro features

### Batch processing

```ts
const results = await ig.batch([
  "https://www.instagram.com/p/A/",
  "https://www.instagram.com/reel/B/",
]);
for (const { url, result, durationMs } of results) {
  console.log(url, result.code, `${durationMs}ms`);
}
```

### Fast mode + prefetch (Telegram/Discord bots)

```ts
const ig = new ultraigdl({ fastMode: true, cookies: "..." });

// Warm extraction while user types
await ig.prefetch(url);

// Often returns from cache within budget
let result = await ig.download(url);
if (result.code === 503 && result.retryAfterMs) {
  await new Promise((r) => setTimeout(r, result.retryAfterMs));
  result = await ig.download(url);
}
```

### Redis cache adapter

```ts
import { ultraigdl, type RedisAdapter } from "ultra-igdl";

const redis: RedisAdapter = {
  async get(key) { /* return string | null */ },
  async set(key, value, ttlMs) { /* ... */ },
};

const ig = new ultraigdl({ redis });
```

### Download files to disk (library)

Use your own `fetch` on `media[].url`, or the CLI `--download` flag (uses built-in file downloader).

---

## Error codes & troubleshooting

| Code | Typical cause | What to do |
|------|---------------|------------|
| **400** | Invalid URL | Use `validate()`; check link format |
| **403** | Private account | Cannot extract without access |
| **404** | Deleted / wrong id / expired story | Verify URL in browser |
| **429** | Rate limited | Slow down; reduce concurrency; wait |
| **500** | Parse/network failure | Retry; update package; report issue |
| **503** | `fastMode` budget exceeded | Retry after `retryAfterMs` or disable fast mode |
| **504** | Timeout | Increase `timeoutMs` |

| Symptom | Fix |
|---------|-----|
| Carousel returns 1 image | Set `cookies` or `sessionId` |
| Reel has no MP4 | Add session cookie |
| CLI `Unexpected token 'npx'` | Use `;` or two lines in PowerShell |
| `Invalid or unexpected token` on CLI | Run `npm run build`; use published version |
| Caption has weird dots/lines | Post captions are flattened to one line by design |
| 403 on CDN URL when downloading | Do not modify signed URL query string |

---

## Examples in this repo

| File | Description |
|------|-------------|
| [`examples/basic.mjs`](./examples/basic.mjs) | Minimal JSON dump |
| [`examples/bot-example.ts`](./examples/bot-example.ts) | Generic bot handler |
| [`examples/express-api.ts`](./examples/express-api.ts) | REST API with Express |
| [`examples/fastify-api.ts`](./examples/fastify-api.ts) | REST API with Fastify |
| [`examples/telegram-bot.ts`](./examples/telegram-bot.ts) | Telegram-style handler |
| [`examples/discord-bot.ts`](./examples/discord-bot.ts) | Discord-style handler |
| [`examples/cookie-generator.mjs`](./examples/cookie-generator.mjs) | Cookie helper notes |

Run locally after build:

```bash
npm run build
node examples/basic.mjs "https://www.instagram.com/p/SHORTCODE/"
```

**Live Instagram tests** are kept in a separate repo folder: `ultra-igdl-live-test` (not published to npm).

---

## Architecture

```
src/
├── core/           # downloader orchestration, cache, parser, extractor
├── extractors/     # post, reel, story, highlight
├── network/        # undici client, headers, retry, pool, Instagram API
├── utils/          # captions, carousel, media quality, URLs
├── cli/            # CLI entry (published as ultra-igdl bin)
└── types/          # TypeScript definitions
```

**Extraction layers** (first useful result wins, posts scan multiple layers for carousels):

1. Open Graph / meta tags  
2. Embedded `application/json` / script blobs  
3. `window.__additionalDataLoaded` / `_sharedData`  
4. Next.js `__NEXT_DATA__`  
5. GraphQL / CDN discovery in HTML  
6. Regex fallback  

With **session**: parallel `media/info` API for posts (carousels), reels, stories, highlights.

---

## Development

```bash
git clone https://github.com/your-username/ultra-igdl.git
cd ultra-igdl
npm install
npm run build
npm test
npm run test:coverage
npm run test:stress
```

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile ESM + CJS + CLI to `dist/` |
| `npm test` | Unit + integration tests (mocked HTTP) |
| `npm run cli -- "<url>" --json` | Run CLI from source tree |
| `npm run lint` | Typecheck |

---

## Publishing to npm

Maintainers:

```bash
# 1. Login
npm login

# 2. Set author/repository in package.json (your GitHub username)

# 3. Dry run — only dist/, README, LICENSE should be listed
npm pack --dry-run

# 4. Publish (runs build + tests via prepublishOnly)
npm publish
```

Consumers install with:

```bash
npm install ultra-igdl
```

**Before first publish:** change `repository`, `bugs`, and `homepage` in `package.json` from `your-username` to your real GitHub path.

---

## Legal & disclaimer

- This project is **not affiliated with Instagram / Meta**.
- You are responsible for complying with Instagram's Terms of Use and applicable laws.
- Only download content you have the right to access and use.
- Session cookies are credentials — treat them like passwords.
- CDN URLs are **signed** and expire; download promptly and do not strip query parameters.

---

## License

[MIT](./LICENSE) © 2026 ultra-igdl contributors