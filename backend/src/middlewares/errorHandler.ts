import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      code: err.statusCode,
      message: err.message,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be 2MB or smaller'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Use form-data file field "images", "images[]", or "image"'
          : err.message;

    res.status(400).json({
      status: 'error',
      code: 400,
      message,
    });
    return;
  }

  // unexpected error — jangan expose detail ke client
  console.error(err);
  res.status(500).json({
    status: 'error',
    code: 500,
    message: 'Internal server error',
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    status: 'error',
    code: 404,
    message: `Route ${req.method} ${req.path} not found`,
  });
};
