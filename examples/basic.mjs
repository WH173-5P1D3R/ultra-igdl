/**
 * Minimal example — run after: npm run build
 *   node examples/basic.mjs "https://www.instagram.com/p/SHORTCODE/"
 */
import { ultraigdl } from "../dist/index.js";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node examples/basic.mjs <instagram-url>");
  process.exit(1);
}

const ig = new ultraigdl({
  // Optional — needed for carousels (all slides), reel MP4, stories:
  // cookies: process.env.INSTAGRAM_COOKIES,
  // sessionId: process.env.INSTAGRAM_SESSION_ID,
});

const result = await ig.download(url);
console.log(JSON.stringify(result, null, 2));