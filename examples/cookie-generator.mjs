/**
 * Minimal cookie builder — copy into your app or run:
 *   node examples/cookie-generator.mjs YOUR_SESSIONID
 */

import { request } from "undici";

const sessionid = process.argv[2]?.trim();
if (!sessionid) {
  console.error("Usage: node examples/cookie-generator.mjs <sessionid>");
  process.exit(1);
}

const res = await request("https://www.instagram.com/", {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    Cookie: `sessionid=${sessionid}`,
  },
});
await res.body.text();

const setCookie = res.headers["set-cookie"];
const parts = [`sessionid=${sessionid}`];
const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
for (const h of list) {
  const name = h.split(";")[0].split("=")[0];
  if (name === "csrftoken" || name === "ds_user_id") {
    parts.push(h.split(";")[0]);
  }
}

const cookies = parts.join("; ");
console.log(JSON.stringify({ sessionId: sessionid, cookies }, null, 2));