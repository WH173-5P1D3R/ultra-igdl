# ultra-igdl

Instagram media extractor for **Node.js 20.18.1+** — posts, reels, carousels, stories, and highlights. Returns direct CDN URLs via the library API or CLI.

[![npm version](https://img.shields.io/npm/v/ultra-igdl.svg)](https://www.npmjs.com/package/ultra-igdl)

## Requirements

- Node.js **20.18.1+** (or 22 LTS)
- Public Instagram URLs
- Optional: logged-in browser cookies for full carousels, reel video, stories, and highlights

## Install

```bash
npm install ultra-igdl
```

CLI without adding to a project:

```bash
npx ultra-igdl --help
```

## Quick start

**ESM**

```js
import { ultraigdl } from "ultra-igdl";

const ig = new ultraigdl();
const result = await ig.download("https://www.instagram.com/reel/SHORTCODE/");

if (result.code === 200) {
  console.log(result.username, result.caption);
  result.media.forEach((m) => console.log(m.type, m.url));
} else {
  console.error(result.code, result.message);
}
```

**CommonJS**

```js
const { ultraigdl } = require("ultra-igdl");

(async () => {
  const ig = new ultraigdl();
  console.log(await ig.download("https://www.instagram.com/p/SHORTCODE/"));
})();
```

**CLI**

```bash
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --download -o ./downloads
```

On Windows PowerShell, wrap URLs in double quotes. Set cookies on one line, then run `npx` on the next (or use `;` between them).

## Session cookies

Logged-out requests often return only one carousel image, reel thumbnails instead of MP4, or no story media. Use cookies from a browser where you are logged in to Instagram (DevTools → Application → Cookies → `instagram.com`): `sessionid`, `csrftoken`, `ds_user_id`.

```js
const ig = new ultraigdl({
  cookies: "sessionid=...; csrftoken=...; ds_user_id=...",
});
// or
const ig = new ultraigdl({ sessionId: "YOUR_SESSIONID" });
```

**CLI / env** (never commit real values):

```bash
export INSTAGRAM_COOKIES="sessionid=...; csrftoken=...; ds_user_id=..."
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

```powershell
$env:INSTAGRAM_COOKIES = "sessionid=...; csrftoken=...; ds_user_id=..."
npx ultra-igdl "https://www.instagram.com/p/SHORTCODE/" --json
```

The CLI also reads `.env` in the current directory.

| Without session | With session |
|-----------------|--------------|
| Single post image | Usually yes |
| Full carousel | Often 1 slide only | All slides |
| Reel MP4 | Often thumbnail only | Video URL |
| Story / highlight | Limited | Reliable when URL is valid |

## CLI

```bash
npx ultra-igdl <url> [options]
npx ultra-igdl urls.txt    # one URL per line
```

| Flag | Description |
|------|-------------|
| `--json`, `-j` | Full JSON response |
| `--download`, `-d` | Save files to `--output` |
| `--output`, `-o` | Download folder (default: `./downloads`) |
| `--verbose`, `-v` | Debug logging |
| `--help`, `-h` | Help |

## Supported URLs

| Type | Example |
|------|---------|
| Post | `https://www.instagram.com/p/{shortcode}/` |
| Reel | `https://www.instagram.com/reel/{shortcode}/` |
| IGTV | `https://www.instagram.com/tv/{shortcode}/` |
| Story | `https://www.instagram.com/stories/{user}/{id}/` |
| Highlight | `https://www.instagram.com/stories/highlights/{id}/` |

## API

```ts
import { ultraigdl } from "ultra-igdl";

const ig = new ultraigdl({ cache: true, sessionId: "..." });
```

| Method | Description |
|--------|-------------|
| `download(url)` | Extract media and metadata |
| `info(url)` | Same as `download` |
| `validate(url)` | Check and normalize URL |
| `media(url)` | Media array only |
| `batch(urls)` | Multiple URLs in parallel |
| `health()` | Version and cache stats |
| `clearCache()` | Clear in-memory cache |

Success responses use `code: 200` with `media[]` (`type`, `url`, optional `width`, `height`, `thumbnail`, `duration`), plus `caption`, `username`, and optional `engagement` / `tags`. Errors return other `code` values and a `message`.

Common options: `sessionId`, `cookies`, `cache`, `timeoutMs`, `retries`, `fastMode`, `verbose`. TypeScript types ship with the package.

## Troubleshooting

| Code / issue | What to try |
|--------------|-------------|
| Carousel has 1 image | Add `cookies` or `sessionId` |
| Reel has no video | Add session cookie |
| 404 | URL deleted, private, or expired story |
| 429 | Slow down requests |
| CDN download fails | Use the URL as returned; do not strip query parameters |

## Disclaimer

Not affiliated with Instagram / Meta. You are responsible for complying with Instagram’s terms and applicable law. Treat session cookies like passwords; CDN links expire.

## License

[MIT](./LICENSE)