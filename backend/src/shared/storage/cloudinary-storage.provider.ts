import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type {
  StorageProvider,
  UploadInput,
  UploadResult,
} from "./storage.types";
import { MIME_TO_EXT } from "./storage.constants";

export interface CloudinaryStorageOptions {
  /** Root folder di akun Cloudinary, mis. `bloods`. */
  folder?: string;
}

export class CloudinaryStorageProvider implements StorageProvider {
  private readonly folder: string;

  constructor(opts: CloudinaryStorageOptions = {}) {
    // Config Cloudinary di-set sekali di src/config/cloudinary.ts
    // (sudah kamu punya). Di sini tidak perlu cloudinary.config() lagi.
    this.folder = opts.folder ?? "bloods";
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const ext = MIME_TO_EXT[input.mimeType];
    if (!ext) {
      throw new Error(`Unsupported MIME for Cloudinary: ${input.mimeType}`);
    }

    const folder = this.buildFolder(input.scope);
    const publicId = randomUUID();

    const res = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            folder,
            resource_type: "image",
            invalidate: true, // purge CDN saat delete
            overwrite: false, // tolak collision
          },
          (err, result) => {
            if (err) return reject(err);
            if (!result)
              return reject(new Error("Cloudinary returned empty result"));
            resolve(result);
          },
        );
        stream.end(input.buffer);
      },
    );

    // Simpan public_id dari RESPONSE, bukan dari input — defense in depth
    // kalau Cloudinary mengubahnya (collision handling, dll).
    return { key: res.public_id, url: res.secure_url };
  }

  async delete(key: string): Promise<void> {
    try {
      const res = await cloudinary.uploader.destroy(key, {
        resource_type: "image",
        invalidate: true,
      });
      // Cloudinary return 'ok' atau 'not found' — keduanya sukses (idempotent)
      if (res.result !== "ok" && res.result !== "not found") {
        throw new Error(`Cloudinary delete failed: ${res.result}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not found/i.test(msg)) return;
      throw err;
    }
  }

  private buildFolder(scope?: string): string | undefined {
    const parts: string[] = [this.folder];
    if (scope) parts.push(...scope.split("/").filter(Boolean));
    return parts.join("/");
  }
}
