# ultra-igdl

**Beginner-friendly Instagram media extractor for Node.js**

Get direct download links (images and videos) from Instagram posts, reels, carousels, stories, and highlights. Use it from the **command line** or inside your **JavaScript / TypeScript** app.

[![total views](https://hitscounter.dev/api/hit?url=https%3A%2F%2Fgithub.com%2FWH173-5P1D3R%2Fultra-igdl&label=total%20views&color=%230d6efd&style=flat)](https://github.com/WH173-5P1D3R/ultra-igdl)
[![total downloads](https://img.shields.io/npm/dt/ultra-igdl?label=total%20downloads)](https://www.npmjs.com/package/ultra-igdl)
[![npm version](https://img.shields.io/npm/v/ultra-igdl.svg)](https://www.npmjs.com/package/ultra-igdl)

**Links:** [npm package](https://www.npmjs.com/package/ultra-igdl) · [GitHub](https://github.com/WH173-5P1D3R/ultra-igdl) · [Telegram bot](https://t.me/igdlw5_bot) · [Web downloader](https://w5-insta-downloader.vercel.app) · [Report issues](https://github.com/WH173-5P1D3R/ultra-igdl/issues)

---

## Table of contents

1. [What does this do?](#1-what-does-this-do)
2. [Who is this for?](#2-who-is-this-for)
3. [Before you start (requirements)](#3-before-you-start-requirements)
4. [Install Node.js and the package](#4-install-nodejs-and-the-package)
5. [Your first download (CLI)](#5-your-first-download-cli)
6. [Your first download (code)](#6-your-first-download-code)
7. [Understanding the JSON response](#7-understanding-the-json-response)
8. [Instagram session — why and how](#8-instagram-session--why-and-how)
9. [Content types (posts, reels, carousels, stories)](#9-content-types-posts-reels-carousels-stories)
10. [Command line (CLI) — full guide](#10-command-line-cli--full-guide)
11. [JavaScript / TypeScript API](#11-javascript--typescript-api)
12. [Configuration options](#12-configuration-options)
13. [Batch URLs and bots](#13-batch-urls-and-bots)
14. [Error codes and fixes](#14-error-codes-and-fixes)
15. [FAQ and troubleshooting](#15-faq-and-troubleshooting)
16. [Example projects (live)](#16-example-projects-live)
17. [Examples in this repository](#17-examples-in-this-repository)
18. [Legal and privacy](#18-legal-and-privacy)
19. [License](#19-license)

---

## 1. What does this do?

You give **ultra-igdl** an Instagram link. It returns:

- **Direct media URLs** (CDN links you can open or save)
- **Caption** and **username**
- Optional **likes / comments** counts when Instagram shows them
- Hints in `tags` (for example: carousel detected, session recommended)

It works **without logging in** for many public posts and reels, but Instagram limits logged-out access. For **full carousels**, **reel video files**, **stories**, and **highlights**, you usually need a **browser session cookie** (explained in [section 8](#8-instagram-session--why-and-how)).

---

## 2. Who is this for?

| You are… | Start here |
|----------|------------|
| **Complete beginner** | [Section 4](#4-install-nodejs-and-the-package) → [Section 5](#5-your-first-download-cli) (CLI with `npx`) |
| **JavaScript developer** | [Section 6](#6-your-first-download-code) → [Section 11](#11-javascript--typescript-api) |
| **Bot builder** (Telegram, Discord, etc.) | [Section 8](#8-instagram-session--why-and-how) + [Section 13](#13-batch-urls-and-bots) |
| **TypeScript user** | [Section 11](#11-javascript--typescript-api) (types included) |
| **Want to try a live demo** | [Section 16](#16-example-projects-live) — Telegram bot and web downloader |

No Instagram API key is required. You only need Node.js and a valid Instagram URL.

---

## 3. Before you start (requirements)

| Requirement | Details |
|-------------|---------|
| **Node.js** | Version **20.18.1 or newer** (22 LTS is fine). Check with `node -v` |
| **npm** | Comes with Node. Check with `npm -v` |
| **Instagram URL** | A normal link you can open in a browser (post, reel, story, etc.) |
| **Session cookie** | Optional but strongly recommended for carousels, reel MP4, stories |

**Check Node version:**

```bash
node -v
# Should print v20.18.1 or higher (e.g. v22.x.x)
```

If Node is too old, install the latest LTS from [https://nodejs.org](https://nodejs.org).

---

## 4. Install Node.js and the package

### Option A — Use without installing (fastest try)

```bash
npx ultra-igdl --help
```

`npx` downloads the tool temporarily and runs it. Good for a quick test.

### Option B — Add to your project (recommended for apps)

```bash
mkdir my-ig-downloader
cd my-ig-downloader
npm init -y
npm install ultra-igdl
```

You can then `import` or `require` it in your code (see [section 6](#6-your-first-download-code)).

---

## 5. Your first download (CLI)

### Step 1 — Copy an Instagram URL

Example (replace with a real public post):

```text
https://www.instagram.com/p/SHORTCODE/
```

### Step 2 — Run the CLI

**Linux / macOS / Git Bash:**

```bash
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/"
```

**Windows PowerShell** — always put the URL in **double quotes**:

```powershell
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/"
```

### Step 3 — Read the output

Without `--json`, you get a short summary: username, caption preview, and a list of media items with type and URL.

For **machine-readable output** (scripts, bots):

```bash
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

### Step 4 — Save files to disk

```bash
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --download --output ./downloads
```

Files go under `./downloads/<username>/`.

---

## 6. Your first download (code)

Create a file `test.mjs` in your project folder (after `npm install ultra-igdl`).

### ESM (modern Node — `"type": "module"` in package.json, or `.mjs` file)

```js
import { ultraigdl } from "ultra-igdl";

const ig = new ultraigdl();
const url = "https://www.instagram.com/reel/SHORTCODE/";

const result = await ig.download(url);

if (result.code === 200) {
  console.log("Creator:", result.username);
  console.log("Caption:", result.caption);
  console.log("Number of files:", result.media.length);
  for (const item of result.media) {
    console.log(item.type, item.url);
  }
} else {
  console.log("Failed:", result.code, result.message);
}
```

Run:

```bash
node test.mjs
```

### CommonJS (`.cjs` file or no `"type": "module"`)

```js
const { ultraigdl } = require("ultra-igdl");

(async () => {
  const ig = new ultraigdl();
  const result = await ig.download("https://www.instagram.com/p/SHORTCODE/");
  console.log(JSON.stringify(result, null, 2));
})();
```

### Handle success vs error (important pattern)

Every call returns an object with a **`code`** field:

- **`200`** — success; use `media`, `caption`, `username`
- **Anything else** — error; read `message`

```js
const result = await ig.download(url);
if (result.code !== 200) {
  throw new Error(`${result.code}: ${result.message}`);
}
// TypeScript: narrow with if (result.code === 200) { ... result.media }
```

---

## 7. Understanding the JSON response

### Successful response (`code: 200`)

```json
{
  "code": 200,
  "meta": {
    "extractor": "ultra-igdl",
    "version": "1.0.2"
  },
  "username": "creator",
  "caption": "Post caption as one clean line",
  "media": [
    {
      "type": "image",
      "url": "https://...cdninstagram.com/....jpg",
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
  "engagement": {
    "likes": 1200,
    "comments": 45
  },
  "tags": ["carousel"]
}
```

### Media object fields

| Field | Meaning |
|-------|---------|
| `type` | `"image"` or `"video"` |
| `url` | Direct link to the file (use as-is; do not remove `?` parameters) |
| `thumbnail` | Preview image for videos |
| `width` / `height` | Pixel size when known |
| `duration` | Video length in seconds |

### Tags (`tags` array) — what they mean for you

| Tag | Meaning | What you should do |
|-----|---------|-------------------|
| `carousel` | Multi-photo post; all slides returned | Nothing — you got the full carousel |
| `partial_carousel` | Carousel detected but only one image returned | Add session cookies ([section 8](#8-instagram-session--why-and-how)) |
| `session_recommended` | Logged-in session would improve results | Add `cookies` or `sessionId` |
| `likes_hidden` | Creator hid like counts | Normal — not an error |
| `comments_hidden` | Comments hidden or disabled | Normal — not an error |
| `engagement_hidden` | Both hidden | Normal — not an error |

### Error response (`code` not 200)

```json
{
  "code": 404,
  "message": "Media not found",
  "meta": { "extractor": "ultra-igdl", "version": "1.0.2" }
}
```

Some responses include `retryAfterMs` when using fast-response mode ([section 13](#13-batch-urls-and-bots)).

---

## 8. Instagram session — why and how

Instagram shows **less content** to visitors who are not logged in.

| Feature | Without session | With session (`cookies` / `sessionId`) |
|---------|-----------------|--------------------------------------|
| Single post image | Usually works | Works (often higher resolution) |
| **Carousel (2+ photos)** | Often **only 1 slide** | **All slides** |
| **Reel MP4 video** | Often thumbnail only | **Full video URL** |
| **Story** | Usually fails or preview only | **Works** (if story is still live) |
| **Highlight** | Limited | More reliable |

### How to get cookies (Chrome / Edge / Firefox)

1. Open [https://www.instagram.com](https://www.instagram.com) and **log in**.
2. Press **F12** to open Developer Tools.
3. Go to **Application** (Chrome) or **Storage** (Firefox) → **Cookies** → `https://www.instagram.com`.
4. Copy these values:
   - `sessionid`
   - `csrftoken`
   - `ds_user_id`

**Treat these like a password.** Never post them on GitHub, Discord, or screenshots.

### Use in code — full cookie string (recommended)

```js
const ig = new ultraigdl({
  cookies:
    "sessionid=YOUR_SESSIONID; csrftoken=YOUR_CSRF; ds_user_id=YOUR_USER_ID",
});
```

### Use in code — session id only

```js
const ig = new ultraigdl({
  sessionId: "YOUR_SESSIONID_VALUE",
});
```

### Use with environment variables (CLI and scripts)

Create a `.env` file in your project folder (add `.env` to `.gitignore`):

```env
INSTAGRAM_COOKIES=sessionid=xxx; csrftoken=xxx; ds_user_id=xxx
```

Or only:

```env
INSTAGRAM_SESSION_ID=your_sessionid_value
```

The CLI loads `.env` from the current directory automatically.

**Linux / macOS terminal:**

```bash
export INSTAGRAM_COOKIES="sessionid=...; csrftoken=...; ds_user_id=..."
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

**Windows PowerShell** — use **two lines** (or semicolon before `npx`):

```powershell
$env:INSTAGRAM_COOKIES = "sessionid=...; csrftoken=...; ds_user_id=..."
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

One-line PowerShell alternative:

```powershell
$env:INSTAGRAM_COOKIES = "sessionid=...; csrftoken=...; ds_user_id=..."; npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

### Load cookies from `process.env` in Node

```js
const ig = new ultraigdl({
  cookies: process.env.INSTAGRAM_COOKIES,
});
```

---

## 9. Content types (posts, reels, carousels, stories)

### Supported URL patterns

| Type | URL pattern |
|------|-------------|
| Post | `https://www.instagram.com/p/{shortcode}/` |
| Reel | `https://www.instagram.com/reel/{shortcode}/` |
| IGTV | `https://www.instagram.com/tv/{shortcode}/` |
| Story | `https://www.instagram.com/stories/{username}/{storyId}/` |
| Highlight | `https://www.instagram.com/stories/highlights/{id}/` |
| Highlight share link | `https://www.instagram.com/s/{token}?story_media_id=...` |

### Single-image post

```js
const result = await ig.download("https://www.instagram.com/p/SHORTCODE/");
// result.media.length is often 1
```

### Carousel (multiple photos)

Same URL as a normal post (`/p/...`). No special mode — the library detects carousels automatically.

```js
const ig = new ultraigdl({ cookies: process.env.INSTAGRAM_COOKIES });
const result = await ig.download("https://www.instagram.com/p/SHORTCODE/");
console.log("Slides:", result.media.length);
console.log("Tags:", result.tags);
```

If you see `partial_carousel` or `session_recommended`, add cookies from [section 8](#8-instagram-session--why-and-how).

### Reel (video)

```js
const ig = new ultraigdl({ sessionId: process.env.INSTAGRAM_SESSION_ID });
const result = await ig.download("https://www.instagram.com/reel/SHORTCODE/");
const video = result.media.find((m) => m.type === "video");
if (video) console.log("MP4:", video.url);
```

### Story

Requires session. The story must still be **live** (not expired after 24 hours).

```js
const ig = new ultraigdl({ cookies: process.env.INSTAGRAM_COOKIES });
const result = await ig.download(
  "https://www.instagram.com/stories/username/1234567890123456789/"
);
```

### Check a URL before downloading

```js
const check = await ig.validate("https://www.instagram.com/p/SHORTCODE/");
console.log(check.valid, check.type, check.normalized);
```

Or use the exported helper:

```js
import { validateUrl, parseInstagramUrl, isInstagramUrl } from "ultra-igdl";

console.log(isInstagramUrl(url));
console.log(parseInstagramUrl(url));
console.log(validateUrl(url));
```

---

## 10. Command line (CLI) — full guide

### Basic usage

```bash
npx ultra-igdl "<instagram-url>"
npx ultra-igdl "<instagram-url>" --json
npx ultra-igdl "<instagram-url>" --download
npx ultra-igdl "<instagram-url>" --download --output ./my-folder
npx ultra-igdl "<instagram-url>" --verbose
```

### Batch file (many URLs)

Create `urls.txt` — one URL per line. Lines starting with `#` are ignored.

```text
https://www.instagram.com/p/ABC123/
https://www.instagram.com/reel/DEF456/
```

Run:

```bash
npx ultra-igdl urls.txt --json
```

### All CLI flags

| Flag | Short | Description |
|------|-------|-------------|
| `--json` | `-j` | Print full API JSON |
| `--download` | `-d` | Save media files to disk |
| `--output <dir>` | `-o` | Download folder (default: `./downloads`) |
| `--verbose` | `-v` | Debug logging |
| `--help` | `-h` | Show help |

### Environment variables (CLI)

| Variable | Purpose |
|----------|---------|
| `INSTAGRAM_COOKIES` | Full cookie string (`sessionid=...; csrftoken=...; ...`) |
| `INSTAGRAM_SESSION_ID` | Just the `sessionid` value |

### PowerShell tips (Windows)

1. **Always quote URLs** that contain `&` (shared links with `?igsh=...&...`).
2. Setting env vars and running `npx` on the **same line** requires a semicolon:

```powershell
$env:INSTAGRAM_COOKIES = "sessionid=..."; npx ultra-igdl "https://www.instagram.com/p/ABC/" --json
```

3. If you see errors about `npx` or `Unexpected token`, run env and `npx` on **separate lines**.

---

## 11. JavaScript / TypeScript API

### Create an instance

```ts
import { ultraigdl, type ApiResponse, type DownloadResponse } from "ultra-igdl";

const ig = new ultraigdl({
  cache: true,
  retries: 2,
  cookies: process.env.INSTAGRAM_COOKIES,
});
```

### Methods

| Method | Returns | When to use |
|--------|---------|-------------|
| `download(url)` | `Promise<ApiResponse>` | Main method — full result |
| `info(url)` | `Promise<ApiResponse>` | Same as `download` |
| `validate(url)` | `Promise<{ valid, type?, normalized? }>` | Check URL before processing |
| `media(url)` | `Promise<Media[] \| ErrorResponse>` | Only the `media` array |
| `batch(urls)` | `Promise<BatchResult[]>` | Many URLs at once |
| `prefetch(url)` | `Promise<ApiResponse>` | Warm cache before `download` (bots) |
| `health()` | `Promise<HealthStatus>` | Version, cache size, connection pool |
| `clearCache()` | `void` | Clear in-memory cache |

### TypeScript — narrow success type

```ts
const result = await ig.download(url);
if (result.code === 200) {
  const ok = result as DownloadResponse;
  ok.media.forEach((m) => console.log(m.url));
}
```

### Download files yourself (library)

Use `fetch` or any HTTP client on `media[].url`, or use the CLI `--download` flag which handles saving for you.

```js
const res = await fetch(result.media[0].url);
const buf = Buffer.from(await res.arrayBuffer());
// write buf to disk with fs
```

**Do not modify** the CDN URL query string — links are signed and may break if edited.

### Exported utilities

```ts
import {
  ultraigdl,
  validateUrl,
  parseInstagramUrl,
  isInstagramUrl,
  PACKAGE_VERSION,
  EXTRACTOR_NAME,
} from "ultra-igdl";
```

Advanced: `DownloaderCore` is exported for custom integrations.

---

## 12. Configuration options

Pass these to `new ultraigdl({ ... })`:

| Option | Default | Description |
|--------|---------|-------------|
| `cache` | `true` | Cache responses in memory |
| `cacheTtlMs` | `300000` (5 min) | Fresh cache lifetime |
| `staleCacheTtlMs` | `86400000` (24 h) | Serve stale while refreshing |
| `cacheMaxSize` | `500` | Max cached entries |
| `timeoutMs` | `8000` | HTTP timeout per request |
| `retries` | `2` | Retry count on failure |
| `maxConcurrency` | `100` | Parallel request limit |
| `userAgentRotation` | `true` | Rotate browser user-agents |
| `sessionId` | — | Instagram `sessionid` cookie value |
| `cookies` | — | Full cookie header string |
| `verbose` | `false` | Extra logging |
| `fastMode` | `false` | Target ~500 ms response; may return 503 + retry hint |
| `responseBudgetMs` | — | Max time for `download()` to return |
| `redis` | — | Custom `RedisAdapter` for shared cache |

Example — tuned for a small API server:

```js
const ig = new ultraigdl({
  cache: true,
  cacheTtlMs: 600_000,
  timeoutMs: 15_000,
  retries: 3,
  cookies: process.env.INSTAGRAM_COOKIES,
});
```

Example — low-latency bot (may need retry on 503):

```js
const ig = new ultraigdl({ fastMode: true, cookies: process.env.INSTAGRAM_COOKIES });
await ig.prefetch(url);
let result = await ig.download(url);
if (result.code === 503 && result.retryAfterMs) {
  await new Promise((r) => setTimeout(r, result.retryAfterMs));
  result = await ig.download(url);
}
```

---

## 13. Batch URLs and bots

### Batch in code

```js
const results = await ig.batch([
  "https://www.instagram.com/p/A/",
  "https://www.instagram.com/reel/B/",
]);

for (const { url, result, durationMs } of results) {
  console.log(url, result.code, `${durationMs}ms`);
}
```

### Batch from CLI

Use a `.txt` file ([section 10](#10-command-line-cli--full-guide)).

### Redis cache (optional, advanced)

If you run multiple server instances, implement `RedisAdapter`:

```ts
import { ultraigdl, type RedisAdapter } from "ultra-igdl";

const redis: RedisAdapter = {
  async get(key) { /* return string | null */ },
  async set(key, value, ttlMs) { /* ... */ },
};

const ig = new ultraigdl({ redis });
```

---

## 14. Error codes and fixes

| Code | Meaning | What to try |
|------|---------|-------------|
| **400** | Invalid URL | Run `validate()`; fix the link |
| **403** | Private or blocked | Cannot access without permission |
| **404** | Not found | Post deleted, wrong ID, or expired story |
| **429** | Rate limited | Wait and slow down; fewer parallel requests |
| **500** | Server / parse error | Retry; update package; open an issue |
| **503** | Fast mode: still fetching | Wait `retryAfterMs` and call `download` again |
| **504** | Timeout | Increase `timeoutMs` |

---

## 15. FAQ and troubleshooting

**Q: Carousel only returns one image.**  
A: Add `INSTAGRAM_COOKIES` or `sessionId` ([section 8](#8-instagram-session--why-and-how)).

**Q: Reel has no video, only thumbnail.**  
A: Same — use a logged-in session cookie.

**Q: Story returns 404.**  
A: Stories expire after 24 hours, or the URL is wrong. Session is required.

**Q: CLI works on Mac but fails on PowerShell.**  
A: Quote the URL; set env vars on a separate line or use `;` before `npx`.

**Q: Downloaded file from CDN is corrupt or 403.**  
A: Copy the `url` exactly from the API response. Do not strip query parameters.

**Q: Caption looks like one long line.**  
A: Post captions are normalized to a single clean line by design (engagement text is in `engagement`, not `caption`).

**Q: How do I update?**  
A: `npm update ultra-igdl` or bump version in `package.json` and run `npm install`.

**Q: Does this need an Instagram API key?**  
A: No. It uses the same kind of page parsing and optional session API as a logged-in browser.

---

## 16. Example projects (live)

Real apps built with **ultra-igdl**. Try them before you integrate the library yourself.

| Project | Link | Description |
|---------|------|-------------|
| **Telegram bot** | [t.me/igdlw5_bot](https://t.me/igdlw5_bot) | Send an Instagram URL in Telegram and get media back |
| **Web downloader** | [w5-insta-downloader.vercel.app](https://w5-insta-downloader.vercel.app) | Paste a link in the browser and download posts, reels, and carousels |

These projects use the same extraction flow described in this README: URL in → direct CDN media out, with session cookies on the server for full reels and carousels.

Starter code for similar apps lives in [`examples/telegram-bot.ts`](./examples/telegram-bot.ts), [`examples/express-api.ts`](./examples/express-api.ts), and [`examples/fastify-api.ts`](./examples/fastify-api.ts).

---

## 17. Examples in this repository

After cloning, build once: `npm run build`.

| File | What it shows |
|------|----------------|
| [`examples/basic.mjs`](./examples/basic.mjs) | Minimal JSON output |
| [`examples/bot-example.ts`](./examples/bot-example.ts) | Generic bot handler |
| [`examples/express-api.ts`](./examples/express-api.ts) | REST API with Express |
| [`examples/fastify-api.ts`](./examples/fastify-api.ts) | REST API with Fastify |
| [`examples/telegram-bot.ts`](./examples/telegram-bot.ts) | Telegram-style flow |
| [`examples/discord-bot.ts`](./examples/discord-bot.ts) | Discord-style flow |
| [`examples/cookie-generator.mjs`](./examples/cookie-generator.mjs) | Cookie setup notes |

Run basic example:

```bash
npm run build
node examples/basic.mjs "https://www.instagram.com/p/SHORTCODE/"
```

---

## 18. Legal and privacy

- **Not affiliated** with Instagram or Meta.
- You must follow **Instagram’s Terms of Use** and your local laws. Only download content you are allowed to use.
- **Session cookies are credentials** — never commit them, share them publicly, or log them in production.
- CDN URLs are **temporary signed links** — download soon; do not alter the URL.

---

## 19. License

[MIT](./LICENSE) — free to use with attribution.

---

**Need help?** Open an issue: [github.com/WH173-5P1D3R/ultra-igdl/issues](https://github.com/WH173-5P1D3R/ultra-igdl/issues)