const SHORTCODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Instagram shortcode → numeric media PK (for media/info API). */
export function shortcodeToMediaPk(shortcode: string): string | null {
  if (!shortcode?.trim()) return null;
  try {
    let id = 0n;
    for (const char of shortcode.trim()) {
      const idx = SHORTCODE_ALPHABET.indexOf(char);
      if (idx < 0) return null;
      id = id * 64n + BigInt(idx);
    }
    return id > 0n ? id.toString() : null;
  } catch {
    return null;
  }
}