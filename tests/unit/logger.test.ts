import { describe, it, expect, vi, afterEach } from "vitest";
import { logger, setLogLevel, setVerbose } from "../../src/utils/logger.js";

describe("logger", () => {
  afterEach(() => {
    setLogLevel("info");
    setVerbose(false);
    vi.restoreAllMocks();
  });

  it("logs at info level", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test");
    expect(spy).toHaveBeenCalled();
  });

  it("logs debug when verbose", () => {
    setVerbose(true);
    setLogLevel("silent");
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.debug("verbose debug");
    expect(spy).toHaveBeenCalled();
  });

  it("respects silent level", () => {
    setLogLevel("silent");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("hidden");
    expect(spy).not.toHaveBeenCalled();
  });
});