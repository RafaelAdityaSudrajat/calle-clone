import { z } from "zod";

/* ── Data (single category) ──────────────────────── */

export const categoryResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CategoryResponse = z.infer<typeof categoryResponseSchema>;

/* ── Envelope helper ─────────────────────────────── */

function successEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data: dataSchema,
  });
}

/* ── Response per endpoint ───────────────────────── */

export const getCategoriesResponseSchema = successEnvelope(
  z.array(categoryResponseSchema),
);

export const createCategoryResponseSchema = successEnvelope(
  categoryResponseSchema,
);

/* ── Payload ─────────────────────────────────────── */

export const createCategoryPayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi")
    .max(50, "Maksimal 50 karakter"),
});

export type CreateCategoryPayload = z.infer<typeof createCategoryPayloadSchema>;
