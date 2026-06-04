import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { ultraigdl } from "../index.js";
import type { DownloadResponse } from "../types/index.js";
import { downloadAllMedia } from "../utils/downloader.js";
import { setVerbose, setLogLevel } from "../utils/logger.js";
import { isInstagramUrl } from "../utils/urls.js";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function progressBar(pct: number, width = 24): string {
  const filled = Math.round((pct / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}] ${pct.toFixed(0)}%`;
}

interface CliArgs {
  urls: string[];
  json: boolean;
  download: boolean;
  output: string;
  verbose: boolean;
  batch: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const urls: string[] = [];
  let json = false;
  let download = false;
  let output = "./downloads";
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--json" || arg === "-j") json = true;
    else if (arg === "--download" || arg === "-d") download = true;
    else if (arg === "--verbose" || arg === "-v") verbose = true;
    else if (arg === "--output" || arg === "-o") {
      output = argv[++i] ?? "./downloads";
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      urls.push(arg);
    }
  }

  return { urls, json, download, output, verbose, batch: false };
}

function loadDotEnv(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", "ultra-igdl-live-test", ".env"),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    break;
  }
}

function sessionFromEnv(): { sessionId?: string; cookies?: string } {
  const cookies = process.env.INSTAGRAM_COOKIES?.trim();
  if (cookies) return { cookies };
  const raw = process.env.INSTAGRAM_SESSION_ID?.trim();
  if (!raw) return {};
  try {
    return { sessionId: decodeURIComponent(raw) };
  } catch {
    return { sessionId: raw };
  }
}

function printHelp(): void {
  console.log(`
${c.bold}ultra-igdl${c.reset} — Advanced Instagram Downloader CLI

${c.cyan}Usage:${c.reset}
  npx ultra-igdl "<url>"
  npx ultra-igdl "<url>" --json
  npx ultra-igdl "<url>" --download
  npx ultra-igdl "<url>" --output ./downloads
  npx ultra-igdl "<url>" --verbose
  npx ultra-igdl urls.txt

${c.cyan}Environment (optional):${c.reset}
  INSTAGRAM_SESSION_ID   sessionid cookie value (carousel, reel MP4, stories)
  INSTAGRAM_COOKIES      full Cookie header

${c.cyan}Options:${c.reset}
  --json, -j       Output JSON response
  --download, -d   Download media files to disk
  --output, -o     Output directory (default: ./downloads)
  --verbose, -v    Verbose logging
  --help, -h       Show this help

${c.dim}PowerShell: wrap URLs in double quotes when they contain & (query params).${c.reset}
`);
}

async function loadUrlsFromFile(path: string): Promise<string[]> {
  const content = await readFile(path, "utf-8");
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function printResult(result: DownloadResponse, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`${c.green}✓${c.reset} ${c.bold}@${result.username || "unknown"}${c.reset}`);
  if (result.caption) {
    console.log(`${c.dim}${result.caption.slice(0, 120)}${result.caption.length > 120 ? "…" : ""}${c.reset}`);
  }
  if (result.tags?.length) {
    console.log(`${c.dim}Tags: ${result.tags.join(", ")}${c.reset}`);
  }
  console.log(`${c.cyan}Media (${result.media.length}):${c.reset}`);
  result.media.forEach((m, i) => {
    const dims = m.width && m.height ? ` ${m.width}x${m.height}` : "";
    const dur = m.duration ? ` ${m.duration}s` : "";
    console.log(`  ${i + 1}. [${m.type}]${dims}${dur}`);
    console.log(`     ${m.url.slice(0, 80)}…`);
  });
}

async function run(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));

  if (args.verbose) {
    setVerbose(true);
    setLogLevel("debug");
  }

  if (!args.urls.length) {
    printHelp();
    process.exit(1);
  }

  let urlList = [...args.urls];
  const first = urlList[0]!;

  if (urlList.length === 1 && (first.endsWith(".txt") || existsSync(first))) {
    if (existsSync(first)) {
      urlList = await loadUrlsFromFile(first);
      console.log(`${c.cyan}Batch mode:${c.reset} ${urlList.length} URLs loaded`);
    }
  }

  const ig = new ultraigdl({ verbose: args.verbose, ...sessionFromEnv() });
  const outputDir = resolve(args.output);

  for (let i = 0; i < urlList.length; i++) {
    const url = urlList[i]!;
    if (!isInstagramUrl(url)) {
      console.error(`${c.red}✗${c.reset} Invalid URL: ${url}`);
      continue;
    }

    console.log(`${c.dim}[${i + 1}/${urlList.length}]${c.reset} ${url}`);
    const start = Date.now();
    const result = await ig.download(url);
    const elapsed = Date.now() - start;

    if (result.code !== 200) {
      console.error(
        `${c.red}✗${c.reset} Error ${result.code}: ${"message" in result ? result.message : "Unknown"}`
      );
      if (args.json) console.log(JSON.stringify(result, null, 2));
      continue;
    }

    printResult(result as DownloadResponse, args.json);
    console.log(`${c.dim}Fetched in ${elapsed}ms${c.reset}`);

    if (args.download && result.code === 200) {
      const media = (result as DownloadResponse).media;
      console.log(`${c.yellow}Downloading ${media.length} file(s)...${c.reset}`);
      const files = await downloadAllMedia(media, {
        outputDir: join(outputDir, (result as DownloadResponse).username || "media"),
        onProgress: (info) => {
          if (!args.verbose) return;
          console.log(
            `  ${progressBar(100)} ${info.filename} ${formatBytes(info.downloaded)} @ ${formatBytes(info.speed)}/s`
          );
        },
      });
      files.forEach((f) => {
        console.log(`${c.green}✓${c.reset} Saved ${f.path} (${formatBytes(f.size)})`);
      });
    }
  }
}

run().catch((err) => {
  console.error(`${c.red}Fatal:${c.reset}`, err);
  process.exit(1);
});