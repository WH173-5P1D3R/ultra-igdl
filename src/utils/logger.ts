export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

let globalLevel: LogLevel = "info";
let verboseEnabled = false;

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export function setVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function shouldLog(level: LogLevel): boolean {
  if (verboseEnabled && level === "debug") return true;
  return LEVELS[level] >= LEVELS[globalLevel];
}

export const logger = {
  debug(...args: unknown[]): void {
    if (shouldLog("debug")) console.debug("[ultra-igdl]", ...args);
  },
  info(...args: unknown[]): void {
    if (shouldLog("info")) console.info("[ultra-igdl]", ...args);
  },
  warn(...args: unknown[]): void {
    if (shouldLog("warn")) console.warn("[ultra-igdl]", ...args);
  },
  error(...args: unknown[]): void {
    if (shouldLog("error")) console.error("[ultra-igdl]", ...args);
  },
};