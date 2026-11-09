import { z } from "zod";
import { ProductStatus } from "../../generated/prisma";

// --- Sub-schema: variant ---
// Business rule: minimal 1 variant wajib ada saat create.
// Kalau produk tanpa variasi ukuran/warna, tetap wajib kirim 1 default variant
// (misal size: "One Size") dari sisi frontend.

const uuid = (field: string) =>
  z.uuid({ error: `${field} must be a valid UUID` });

export const createVariantBodySchema = z.strictObject({
  sku: z
    .string()
    .min(3, "SKU minimal 3 karakter")
    .max(50, "SKU maksimal 50 karakter"),
  size: z.string().trim().max(50).optional(),
  color: z.string().trim().max(50).optional(),
  priceOverride: z
    .number()
    .positive("Harga override harus lebih dari 0")
    .optional(),
  stock: z
    .number()
    .int("Stock harus bilangan bulat")
    .nonnegative("Stock tidak boleh negatif"),
});

// update — partial + nullable + tanpa stock
export const updateVariantBodySchema = z
  .strictObject({
    sku: z.string().trim().min(3).max(50).optional(),
    size: z.string().trim().max(50).nullable().optional(),
    color: z.string().trim().max(50).nullable().optional(),
    priceOverride: z
      .number()
      .positive("Harga override harus lebih dari 0")
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    // stock TIDAK ada — inventory via endpoint terpisah
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "Minimal satu field harus diubah",
  });

export const updateVariantSchema = {
  body: updateVariantBodySchema,
};

// --- Sub-schema: image ---
const imageSchema = z.strictObject({
  url: z.string().url("URL gambar tidak valid"),
  isPrimary: z.boolean().optional().default(false),
  sortOrder: z.number().int().nonnegative().optional().default(0),
});

// --- Main schema: create product ---
export const createProductBodySchema = z
  .strictObject({
    categoryId: z.string().uuid("categoryId harus berupa UUID valid"),
    name: z
      .string()
      .min(3, "Nama produk minimal 3 karakter")
      .max(255, "Nama produk maksimal 255 karakter"),
    description: z.string().trim().min(10).max(5000).nullable().optional(),
    basePrice: z.number().positive("Harga dasar harus lebih dari 0"),
    images: z.array(imageSchema).min(1, "Produk wajib punya minimal 1 gambar"),
    variants: z
      .array(createVariantBodySchema)
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
  );

export const createProductSchema = {
  body: createProductBodySchema,
};

export const updateProductBodySchema = z
  .strictObject({
    name: z.string().trim().min(3).max(255).optional(),
    description: z.string().trim().min(10).max(5000).nullable().optional(),
    basePrice: z.number().positive("Harga dasar harus lebih dari 0").optional(),
    categoryId: z.string().uuid("categoryId harus UUID valid").optional(),
    status: z.nativeEnum(ProductStatus).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Minimal satu field harus diubah",
  });

export const updateProductSchema = {
  body: updateProductBodySchema,
};

export const slugParamsSchema = z.strictObject({
  slug: z.string().trim().toLowerCase().min(1, "slug tidak boleh kosong"),
});

export const productIdParamsSchema = z.strictObject({
  productId: uuid("ProductId"),
});

export const productVarintIdParamsSchema = z.strictObject({
  product_variant_id: uuid("product_variant_id"),
});

export type CreateProductInput = z.infer<typeof createProductBodySchema>;
export type UpdateProductInput = z.infer<typeof updateProductBodySchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantBodySchema>;

export type SlugParams = z.output<typeof slugParamsSchema>;
export type ProductIdParams = z.output<typeof productIdParamsSchema>;
export type productVarintIdParams = z.output<
  typeof productVarintIdParamsSchema
>;
