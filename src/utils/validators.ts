import { isInstagramUrl, parseInstagramUrl } from "./urls.js";

export interface ValidationResult {
  valid: boolean;
  type?: string;
  normalized?: string;
  error?: string;
}

export function validateUrl(input: string): ValidationResult {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "URL must be a non-empty string" };
  }

  try {
    new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (!isInstagramUrl(input)) {
    return { valid: false, error: "Not a supported Instagram URL" };
  }

  const parsed = parseInstagramUrl(input);
  return {
    valid: true,
    type: parsed.type,
    normalized: parsed.normalized,
  };
}