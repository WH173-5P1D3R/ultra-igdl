import { DownloaderCore } from "./core/downloader.js";
import type {
  UltraIgdlOptions,
  ApiResponse,
  Media,
  HealthStatus,
  BatchResult,
} from "./types/index.js";

export { DownloaderCore };
export type {
  UltraIgdlOptions,
  ApiResponse,
  DownloadResponse,
  Media,
  Engagement,
  EngagementTag,
  PostContentTag,
  ResultTag,
  HealthStatus,
  BatchResult,
  RedisAdapter,
  ErrorResponse,
} from "./types/index.js";
export type { ValidationResult } from "./utils/validators.js";
export { validateUrl } from "./utils/validators.js";
export { parseInstagramUrl, isInstagramUrl } from "./utils/urls.js";
export { PACKAGE_VERSION, EXTRACTOR_NAME } from "./types/index.js";

export class ultraigdl {
  private core: DownloaderCore;

  constructor(options?: UltraIgdlOptions) {
    this.core = new DownloaderCore(options);
  }

  download(url: string): Promise<ApiResponse> {
    return this.core.download(url);
  }

  info(url: string): Promise<ApiResponse> {
    return this.core.info(url);
  }

  validate(url: string): Promise<{ valid: boolean; type?: string; normalized?: string }> {
    return this.core.validate(url);
  }

  media(url: string): Promise<Media[] | import("./types/index.js").ErrorResponse> {
    return this.core.media(url);
  }

  batch(urls: string[]): Promise<BatchResult[]> {
    return this.core.batch(urls);
  }

  health(): Promise<HealthStatus> {
    return this.core.health();
  }

  clearCache(): void {
    this.core.clearCache();
  }

  /** Start extraction now so the next `download()` can return within `responseBudgetMs`. */
  prefetch(url: string): Promise<ApiResponse> {
    return this.core.prefetch(url);
  }
}

export default ultraigdl;