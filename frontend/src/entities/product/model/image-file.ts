// Batas ini asumsiku: sesuaikan dengan middleware imageUpload di backend.
export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const IMAGE_FIELD_NAME = "file";
export const IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const validateImageFile = (file: File): string | null => {
  if (file.size === 0) return "File kosong";
  if (!(IMAGE_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Format harus JPG, PNG, atau WebP";
  }
  if (file.size > IMAGE_MAX_SIZE_BYTES) {
    return `Ukuran file maksimal ${IMAGE_MAX_SIZE_BYTES / 1024 / 1024} MB`;
  }
  return null;
};