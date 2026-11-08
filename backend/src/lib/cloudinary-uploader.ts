import cloudinary from "../config/cloudinary";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload single buffer (dari multer memoryStorage) ke Cloudinary.
 *
 * Flag:
 *  - `invalidate: true`  → purge CDN cache saat delete
 *  - `overwrite: false`  → tolak collision publicId (UUID = unique)
 */
export function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        invalidate: true,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload failed"));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

/**
 * Hapus asset dari Cloudinary. Idempotent:
 *  - `result: "ok"` → file ada, terhapus
 *  - `result: "not found"` → file tidak ada, dianggap sukses
 *
 * Dipakai sebagai **compensating delete** kalau insert DB gagal
 * setelah upload sukses → mencegah orphan file.
 *
 * `invalidate: true` → purge CDN cache (kalau ada yang sudah cache
 * file ini, cache akan di-refresh dari origin — yang sekarang 404).
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
    if (res.result !== "ok" && res.result !== "not found") {
      throw new Error(`Cloudinary delete failed: ${res.result}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(msg)) return;
    throw err;
  }
}
