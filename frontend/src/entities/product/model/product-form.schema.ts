import { z } from "zod";
import type { ProductPayload } from "./product.types";

// Batas selaras backend: name 1..200, description <= 5000.
export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama produk wajib diisi")
    .max(200, "Nama produk maksimal 200 karakter"),
  description: z.string().trim().max(5000, "Deskripsi maksimal 5000 karakter"),
  // "" = belum dipilih. Wajib terisi hanya saat publish (dicek backend).
  categoryId: z.union([z.literal(""), z.uuid("Kategori tidak valid")]),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

// Create dan update memakai payload yang sama: "" dikirim sebagai null.
export const toProductPayload = (values: ProductFormValues): ProductPayload => ({
  name: values.name,
  description: values.description || null,
  category_id: values.categoryId || null,
});