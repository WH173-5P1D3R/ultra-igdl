export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn?: (error: unknown, statusCode?: number) => boolean;
}

const DEFAULT_RETRY_ON = (error: unknown, statusCode?: number): boolean => {
  if (statusCode === 429 || statusCode === 503 || statusCode === 502) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("socket") ||
      msg.includes("network")
    );
  }
  return false;
};

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 300,
    maxDelayMs = 8000,
    retryOn = DEFAULT_RETRY_ON,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? (error as { statusCode: number }).statusCode
          : undefined;

      if (attempt >= maxRetries || !retryOn(error, statusCode)) {
        throw error;
      }

      const jitter = Math.random() * 100;
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + jitter,
        maxDelayMs
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}