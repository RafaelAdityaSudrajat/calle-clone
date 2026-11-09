import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_UPLOAD_FIELD,
  MAX_IMAGE_SIZE_BYTES,
} from "./storage.constants";
import { MulterErrors } from "../../lib/multer.errors";

const MAX_MB = MAX_IMAGE_SIZE_BYTES / 1024 / 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      return cb(MulterErrors.INVALID_FILE_TYPE(file.mimetype));
    }
    cb(null, true);
  },
}).single(IMAGE_UPLOAD_FIELD);

export const imageUpload: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(MulterErrors.FILE_TOO_LARGE(MAX_MB));
      }
      return next(MulterErrors.INTERNAL_ERROR(err.code));
    }
    if (err) return next(err);
    if (!req.file) {
      return next(MulterErrors.VALIDATION_ERROR(IMAGE_UPLOAD_FIELD));
    }
    next();
  });
};
