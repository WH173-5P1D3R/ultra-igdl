import { decodeHtmlEntities } from "../core/parser.js";

/** Turn literal \\n, \\r\\n, \\u000a, etc. into real line breaks (incl. double-escaped API/HTML). */
export function unescapeCaptionEscapes(text: string): string {
  let cur = text;
  for (let i = 0; i < 4; i++) {
    const next = cur
      .replace(/\\+u000d\\+u000a/gi, "\n")
      .replace(/\\+u000a/gi, "\n")
      .replace(/\\+u000d/gi, "\n")
      .replace(/\\+r\\+n/gi, "\n")
      .replace(/\\+n/g, "\n")
      .replace(/\\+r/g, "\n");
    if (next === cur) break;
    cur = next;
  }
  return cur.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n");
}

/** Preserve internal newlines; decode entities and JSON-style escapes. */
export function normalizeCaptionText(raw: string): string {
  if (!raw) return "";
  let text = unescapeCaptionEscapes(decodeHtmlEntities(raw));
  text = text.replace(/^\s+/, "").replace(/\s+$/, "");
  text = text.replace(/^["'\u201c\u201d]+|["'\u201d\u201c]+$/g, "");
  return text;
}

/** Drop lone "." / "…" lines and extra breaks (common on Instagram post captions). */
export function cleanInstagramCaptionLayout(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept = lines
    .map((line) => line.trim())
    .filter((line) => line && !/^\.+$/.test(line) && !/^[\u2026…]+$/.test(line));
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

/** Post captions: unescape + flatten to a single readable line (no \\n in JSON output). */
export function normalizePostCaptionText(raw: string): string {
  return cleanInstagramCaptionLayout(normalizeCaptionText(raw));
}