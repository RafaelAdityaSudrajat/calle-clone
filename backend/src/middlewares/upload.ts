import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ValidationError } from '../lib/errors';

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
