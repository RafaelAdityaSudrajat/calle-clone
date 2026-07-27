import cloudinary from "../config/cloudinary"; // sesuaikan path ke file config lo

// File ini TIDAK melakukan cloudinary.config() lagi — itu tanggung jawab
// src/config/cloudinary.ts yang sudah lo buat. Di sini cuma logic upload-nya.

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload single buffer (dari multer memoryStorage) ke Cloudinary.
 * Pakai upload_stream karena kita gak punya file path di disk,
 * cuma buffer di memory.
 */
export function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload gagal"));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Upload banyak file sekaligus secara paralel.
 * Kalau salah satu gagal, Promise.all langsung reject —
 * caller (middleware) yang tangani rollback/cleanup kalau perlu.
 */
export async function uploadManyToCloudinary(
  files: Express.Multer.File[],
  folder: string
): Promise<CloudinaryUploadResult[]> {
  return Promise.all(
    files.map((file) => uploadBufferToCloudinary(file.buffer, folder))
  );
}