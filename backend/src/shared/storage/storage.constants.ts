export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const ALLOWED_IMAGE_MIME_TYPES = Object.keys(MIME_TO_EXT);
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, NFR-PM-06
export const IMAGE_UPLOAD_FIELD = "file";
