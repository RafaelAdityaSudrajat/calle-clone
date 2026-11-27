import { z } from "zod";
import { isApiError } from "@/shared/api";
import type { ProductDetail } from "./product.schema";

export const publishFailureSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type PublishFailure = z.infer<typeof publishFailureSchema>;

// Backend mengirim semua kegagalan sekaligus di `details` (BR-08).
export const getPublishFailures = (error: unknown): PublishFailure[] => {
  if (!isApiError(error)) return [];
  const parsed = z.array(publishFailureSchema).min(1).safeParse(error.details);
  return parsed.success ? parsed.data : [];
};

export const PUBLISH_FAILURE_LABELS: Readonly<Record<string, string>> = {
  PRODUCT_NEEDS_VARIANT: "Tambahkan minimal 1 varian aktif",
  INVALID_PRICE: "Semua varian aktif harus berharga lebih dari 0",
  PRODUCT_NEEDS_IMAGE: "Unggah minimal 1 gambar",
  PRODUCT_NEEDS_PRIMARY_IMAGE: "Tentukan 1 gambar utama",
  CATEGORY_REQUIRED: "Pilih kategori produk",
};

export const getPublishFailureLabel = (failure: PublishFailure): string =>
  PUBLISH_FAILURE_LABELS[failure.code] ?? failure.message;

/**
 * Cermin client-side dari BR-07 untuk menampilkan checklist sebelum tombol publish ditekan.
 * Hanya saran UX: backend tetap satu-satunya penentu (atomik di SQL).
 */
export const getPublishReadiness = (product: ProductDetail): PublishFailure[] => {
  const failures: PublishFailure[] = [];
  const activeVariants = product.variants.filter((v) => v.deleted_at === null);
  const add = (code: string) =>
    failures.push({ code, message: PUBLISH_FAILURE_LABELS[code] ?? code });

  if (activeVariants.length === 0) add("PRODUCT_NEEDS_VARIANT");
  if (activeVariants.some((v) => v.price <= 0)) add("INVALID_PRICE");
  if (product.images.length === 0) {
    add("PRODUCT_NEEDS_IMAGE");
    add("PRODUCT_NEEDS_PRIMARY_IMAGE");
  } else if (!product.images.some((i) => i.is_primary)) {
    add("PRODUCT_NEEDS_PRIMARY_IMAGE");
  }
  if (!product.category) add("CATEGORY_REQUIRED");

  return failures;
};