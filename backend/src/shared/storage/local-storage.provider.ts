import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { MIME_TO_EXT } from "./storage.constants";
import type {
  StorageProvider,
  UploadInput,
  UploadResult,
} from "./storage.types";

export interface LocalStorageOptions {
  /** Folder fisik, absolut. */
  baseDir: string;
  /** URL prefix untuk akses statis, mis. `/uploads`. */
  publicPath: string;
}

export class LocalStorageProvider implements StorageProvider {
  private readonly baseResolved: string;

  constructor(private readonly opts: LocalStorageOptions) {
    this.baseResolved = resolve(opts.baseDir);
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const ext = MIME_TO_EXT[input.mimeType];
    if (!ext) {
      throw new Error(`Unsupported MIME for local storage: ${input.mimeType}`);
    }

    const scope = sanitizeScope(input.scope);
    const filename = `${randomUUID()}${ext}`;
    const key = scope ? `${scope}/${filename}` : filename;

    const fullPath = this.toSafePath(key);
    await mkdir(resolve(this.baseResolved, scope ?? ""), { recursive: true });
    await writeFile(fullPath, input.buffer);

    return {
      key,
      url: `${this.opts.publicPath.replace(/\/+$/, "")}/${key}`,
    };
  }

  /**
   * Idempotent: file tidak ada = sukses (sama seperti Cloudinary & S3).
   * Wajib, karena ImageService akan panggil delete sebagai kompensasi
   * kalau insert DB gagal setelah upload.
   */
  async delete(key: string): Promise<void> {
    const fullPath = this.toSafePath(key);
    try {
      await unlink(fullPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  /**
   * Cegah path traversal. `key` dari DB (`file_key`) seharusnya aman,
   * tapi defense-in-depth tetap penting (backup restore, corrupted data, dll).
   */
  private toSafePath(key: string): string {
    const full = resolve(this.baseResolved, key);
    if (
      full !== this.baseResolved &&
      !full.startsWith(this.baseResolved + sep)
    ) {
      throw new Error(`Refusing path outside baseDir: ${key}`);
    }
    return full;
  }
}

/** Buang segmen `..` dan leading/trailing slash dari scope. */
function sanitizeScope(scope: string | undefined): string | undefined {
  if (!scope) return undefined;
  const parts = scope
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== "..");
  return parts.length ? parts.join("/") : undefined;
}
