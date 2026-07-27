import { Request, Response, NextFunction } from "express";
import { ConflictError } from "../../lib/errors";
import {
  normalizeUploadedFiles,
  productImageUploadFields,
} from "../../middlewares/upload";
import { uploadManyToCloudinary } from "../../lib/cloudinary";
import catchAsync from "../../lib/catchAsync";

/**
 * Middleware ini jalan SETELAH multer, SEBELUM Zod validate.
 * Tugasnya 2:
 * 1. Upload semua file buffer ke Cloudinary -> dapet array of URL
 * 2. Normalize field lain di req.body yang datang sebagai string
 *    (karena multipart/form-data), supaya Zod schema bisa parse
 *    dengan tipe data yang benar (number, array of object, dst)
 */
export const handleProductImageUpload = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    // --- 1. Normalize & upload images ---
    const files = normalizeUploadedFiles(
      req.files as
        | Express.Multer.File[]
        | Record<string, Express.Multer.File[]>,
    );

    if (files.length === 0) {
      throw new ConflictError("Produk wajib punya minimal 1 gambar");
    }

    const uploaded = await uploadManyToCloudinary(files, "products");

    // Bentuk array images sesuai shape yang diharapkan createProductSchema.
    // isPrimary: gambar pertama otomatis jadi primary kalau buyer/admin
    // gak eksplisit nentuin lewat field terpisah (bisa disesuaikan
    // kalau lo mau kasih kontrol manual dari frontend).
    req.body.images = uploaded.map((img, index) => ({
      url: img.url,
      isPrimary: index === 0,
      sortOrder: index,
    }));

    // --- 2. Normalize field lain dari string -> tipe asli ---
    // basePrice datang sebagai string "150000" dari form-data
    if (typeof req.body.basePrice === "string") {
      req.body.basePrice = Number(req.body.basePrice);
    }

    // variants dikirim frontend sebagai JSON string, misal:
    // formData.append('variants', JSON.stringify([{ sku: '...', stock: 10 }]))
    if (typeof req.body.variants === "string") {
      try {
        req.body.variants = JSON.parse(req.body.variants);
      } catch {
        throw new ConflictError(
          "Format variants tidak valid, harus berupa JSON array",
        );
      }
    }

    next();
  },
);
