import { AppError } from "./errors";

export const MulterErrors = {
  INVALID_FILE_TYPE: (mimetype: string) =>
    new AppError(
      `Unsupported file type: ${mimetype}`,
      400,
      "INVALID_FILE_TYPE",
    ),

  FILE_TOO_LARGE: (maxMb: number) =>
    new AppError(`File exceeds ${maxMb}MB`, 400, "FILE_TOO_LARGE"),
  VALIDATION_ERROR: (field = "file") =>
    new AppError(`Missing file (field: "${field}")`, 400, "VALIDATION_ERROR"),
  INTERNAL_ERROR: (multerCode: string) =>
    new AppError(`Upload failed: ${multerCode}`, 500, "INTERNAL_ERROR"),
};
