type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const VALID_LEVELS: ReadonlySet<string> = new Set(["debug", "info", "warn", "error"]);
const envLevel = import.meta.env.VITE_LOG_LEVEL;
const currentLevel: LogLevel =
  envLevel && VALID_LEVELS.has(envLevel) ? (envLevel as LogLevel) : "info";

function shouldLog(level: LogLevel): boolean {
  return (LOG_LEVELS[level] ?? 0) >= (LOG_LEVELS[currentLevel] ?? 1);
}

/* eslint-disable no-console -- this IS the logger wrapper */
export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) console.debug("[R2F]", ...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog("info")) console.info("[R2F]", ...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) console.warn("[R2F]", ...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog("error")) console.error("[R2F]", ...args);
  },
};
/* eslint-enable no-console */
