import { describe, it, expect } from "vitest";
import { parseHtml } from "../../src/core/parser.js";

describe("parser fallback and upgrade paths", () => {
  it("uses url regex fallback for cdn urls", () => {
    const html = `<body>"url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/t51.mp4"</body>`;
    const result = parseHtml(html);
    expect(result?.media.some((m) => m.type === "video")).toBe(true);
  });

  it("sorts multiple images when no video", () => {
    const html = `
    <script type="application/ld+json">[
      {"@type":"ImageObject","contentUrl":"https://cdninstagram.com/s.jpg","width":100,"height":100},
      {"@type":"ImageObject","contentUrl":"https://cdninstagram.com/l.jpg","width":2000,"height":2000}
    ]</script>`;
    const result = parseHtml(html);
    expect(result?.media[0]?.width).toBe(2000);
  });

  it("detects strict private login page", () => {
    const html = "login Log in to Instagram";
    const result = parseHtml(html);
    expect(result?.isPrivate).toBe(true);
  });
});