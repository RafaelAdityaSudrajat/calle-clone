import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ValidationError } from '../lib/errors';
import cloudinary from "../config/cloudinary"; // sesuaikan path ke file config lo


const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const storage = multer.memoryStorage();


//buat validasi file dari request kalo misalnya file != ALLOWED_TYPES maka error
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    cb(new ValidationError('Only JPEG, PNG, and WebP images are allowed'));
    return;
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

export const ensureMultipartFormData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.is('multipart/form-data')) {
    next();
    return;
  }

  next(
    new ValidationError(
      'Request must use multipart/form-data with file field "images"'
    )
  );
};

export const productImageUploadFields = [
  { name: 'images', maxCount: 5 },
  { name: 'images[]', maxCount: 5 },
  { name: 'image', maxCount: 5 },
] as const;

type UploadedFiles =
  | Express.Multer.File[]
  | Record<string, Express.Multer.File[]>
  | undefined;

export const normalizeUploadedFiles = (files: UploadedFiles): Express.Multer.File[] => {
  if (!files) {
    return [];
  }

  if (Array.isArray(files)) {
    return files;
  }

  return Object.values(files).flat();
};



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
