import { z } from "zod";

export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "INACTIVE"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

const isoDate = z.iso.datetime();
const categoryRefSchema = z.object({ id: z.uuid(), name: z.string() });

// ── List ──────────────────────────────────────────────
export const productListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  category: categoryRefSchema.nullable(),
  status: productStatusSchema,
  primary_image_url: z.string().nullable(),
  variant_count: z.number().int(),
  total_stock: z.number().int(),
  created_at: isoDate,
  updated_at: isoDate,
});
export type ProductListItem = z.infer<typeof productListItemSchema>;

export const paginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const productListResponseSchema = z.object({
  items: z.array(productListItemSchema),
  pagination: paginationSchema,
});
export type ProductListResponse = z.infer<typeof productListResponseSchema>;

// ── Varian & gambar ───────────────────────────────────
export const variantSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  price: z.number(),
  stock: z.number().int(),
  low_stock: z.boolean(),
  deleted_at: isoDate.nullable(),
});
export type Variant = z.infer<typeof variantSchema>;

export const imageSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  is_primary: z.boolean(),
  sort_order: z.number().int(),
});
export type ProductImage = z.infer<typeof imageSchema>;

// ── Detail ────────────────────────────────────────────
export const productDetailSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category: categoryRefSchema.nullable(),
  status: productStatusSchema,
  variants: z.array(variantSchema),
  images: z.array(imageSchema),
  created_by: z.string(),
  updated_by: z.string(),
  created_at: isoDate,
  updated_at: isoDate,
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

// ── Respons mutation ──────────────────────────────────
export const createProductResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category_id: z.uuid().nullable(),
  status: productStatusSchema,
  created_by: z.string(),
  created_at: isoDate,
});
export type CreateProductResponse = z.infer<typeof createProductResponseSchema>;

export const updateProductResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category_id: z.uuid().nullable(),
  status: productStatusSchema,
  updated_by: z.string(),
  updated_at: isoDate,
});

export const statusChangeResponseSchema = z.object({
  id: z.uuid(),
  status: productStatusSchema,
});
export type StatusChangeResponse = z.infer<typeof statusChangeResponseSchema>;

// create & update varian punya bentuk respons yang sama
export const variantMutationResponseSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  price: z.number(),
  stock: z.number().int(),
  low_stock: z.boolean(),
});
export type VariantMutationResponse = z.infer<
  typeof variantMutationResponseSchema
>;

export const variantListResponseSchema = z.object({
  items: z.array(variantSchema),
});

export const stockResponseSchema = z.object({
  id: z.uuid(),
  stock: z.number().int(),
  low_stock: z.boolean(),
});

export const lowStockItemSchema = z.object({
  variant_id: z.uuid(),
  product_id: z.uuid(),
  product_name: z.string(),
  sku: z.string(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  stock: z.number().int(),
});
export type LowStockItem = z.infer<typeof lowStockItemSchema>;
export const lowStockListResponseSchema = z.object({
  items: z.array(lowStockItemSchema),
});

export const setPrimaryResponseSchema = z.object({
  id: z.uuid(),
  is_primary: z.literal(true),
});
