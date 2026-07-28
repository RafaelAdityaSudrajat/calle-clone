import { z } from "zod";

// --- Sub-schema: variant ---
// Business rule: minimal 1 variant wajib ada saat create.
// Kalau produk tanpa variasi ukuran/warna, tetap wajib kirim 1 default variant
// (misal size: "One Size") dari sisi frontend.
const variantSchema = z.object({
  sku: z
    .string()
    .min(3, "SKU minimal 3 karakter")
    .max(50, "SKU maksimal 50 karakter"),
  size: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  priceOverride: z
    .number()
    .positive("Harga override harus lebih dari 0")
    .optional(),
  stock: z
    .number()
    .int("Stock harus bilangan bulat")
    .nonnegative("Stock tidak boleh negatif"),
});

// --- Sub-schema: image ---
const imageSchema = z.object({
  url: z.string().url("URL gambar tidak valid"),
  isPrimary: z.boolean().optional().default(false),
  sortOrder: z.number().int().nonnegative().optional().default(0),
});

// --- Main schema: create product ---
export const createProductSchema = z.object({
  body: z
    .object({
      categoryId: z.string().uuid("categoryId harus berupa UUID valid"),
      name: z
        .string()
        .min(3, "Nama produk minimal 3 karakter")
        .max(255, "Nama produk maksimal 255 karakter"),
      description: z.string().min(10, "Deskripsi minimal 10 karakter"),
      basePrice: z.number().positive("Harga dasar harus lebih dari 0"),
      images: z
        .array(imageSchema)
        .min(1, "Produk wajib punya minimal 1 gambar"),
      variants: z
        .array(variantSchema)
        .min(1, "Produk wajib punya minimal 1 variant"),
    })
    .refine(
      (data) => {
        // Business rule: kombinasi SKU dalam satu payload tidak boleh duplikat
        const skus = data.variants.map((v) => v.sku);
        return new Set(skus).size === skus.length;
      },
      { message: "SKU pada variant tidak boleh duplikat", path: ["variants"] },
    )
    .refine(
      (data) => {
        // Business rule: kombinasi size+color per produk tidak boleh duplikat
        const combos = data.variants.map(
          (v) => `${v.size ?? ""}-${v.color ?? ""}`,
        );
        return new Set(combos).size === combos.length;
      },
      {
        message: "Kombinasi size & color pada variant tidak boleh duplikat",
        path: ["variants"],
      },
    ),
});

export const updateProductSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").optional(),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive").optional(),
  stock: z.number().int().nonnegative("Stock must be non-negative").optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  isActive: z.boolean().optional(),
});

export type UpdateProductInputZod = z.infer<typeof updateProductSchema>;

export const getProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type GetProductsQuery = z.infer<typeof getProductsQuerySchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
