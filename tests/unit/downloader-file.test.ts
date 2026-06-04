import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as requestModule from "../../src/network/request.js";
import {
  downloadMediaFile,
  downloadAllMedia,
  generateFilename,
} from "../../src/utils/downloader.js";

describe("file downloader", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ultra-igdl-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("downloads a file to disk", async () => {
    const content = Buffer.from("fake-image-data");
    vi.spyOn(requestModule, "request").mockResolvedValue({
      statusCode: 200,
      headers: { "content-length": String(content.length) },
      body: (async function* () {
        yield content;
      })(),
    } as never);

    const out = join(dir, "test.jpg");
    const result = await downloadMediaFile(
      { type: "image", url: "https://cdninstagram.com/test.jpg" },
      out,
      0
    );
    expect(result.size).toBeGreaterThan(0);
    const data = await readFile(out);
    expect(data.length).toBeGreaterThan(0);
  });

  it("downloadAllMedia processes list", async () => {
    vi.spyOn(requestModule, "request").mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: (async function* () {
        yield Buffer.from("x");
      })(),
    } as never);

    const files = await downloadAllMedia(
      [
        { type: "image", url: "https://cdninstagram.com/a.jpg" },
        { type: "video", url: "https://cdninstagram.com/b.mp4" },
      ],
      {
        outputDir: dir,
        onProgress: () => {},
      }
    );
    expect(files).toHaveLength(2);
    expect(generateFilename({ type: "image", url: "https://x.com/p.png" }, 0)).toContain("image");
  });

  it("retries failed downloads", async () => {
    let calls = 0;
    vi.spyOn(requestModule, "request").mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        return { statusCode: 500, headers: {}, body: { text: async () => "" } } as never;
      }
      return {
        statusCode: 200,
        headers: {},
        body: (async function* () {
          yield Buffer.from("ok");
        })(),
      } as never;
    });

    const out = join(dir, "retry.jpg");
    await downloadMediaFile(
      { type: "image", url: "https://cdninstagram.com/r.jpg" },
      out,
      2
    );
    expect(calls).toBe(2);
  });
});