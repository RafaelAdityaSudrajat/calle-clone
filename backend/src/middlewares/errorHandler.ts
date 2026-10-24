import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Jika response sudah mulai dikirim, serahkan penanganan
  // berikutnya kepada Express agar tidak mencoba mengirim response kedua.
  if (res.headersSent) {
    next(err);
    return;
  }

  // Handle AppError (custom errors dari service layer)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      code: err.code ?? "APP_ERROR",
      message: err.message,
      ...(err.details !== undefined ? { data: err.details } : {}),
    });
    return;
  }

  // Handle Multer errors (upload file)
  // Error upload file.
  if (err instanceof multer.MulterError) {
    const isFileTooLarge = err.code === "LIMIT_FILE_SIZE";
    const isUnexpectedFile = err.code === "LIMIT_UNEXPECTED_FILE";

    const code = isFileTooLarge
      ? "FILE_TOO_LARGE"
      : isUnexpectedFile
        ? "UNEXPECTED_FILE"
        : "UPLOAD_ERROR";

    const message = isFileTooLarge
      ? "Each image must be 2MB or smaller"
      : isUnexpectedFile
        ? 'Use form-data file field "images", "images[]", or "image"'
        : "Upload failed";

    res.status(400).json({
      status: "error",
      code,
      message,
    });

    return;
  }

  // Unexpected error — jangan expose detail ke client
  console.error("Unexpected error:", err);
  res.status(500).json({
    status: "error",
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    status: "error",
    code: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} not found`,
  });
};
