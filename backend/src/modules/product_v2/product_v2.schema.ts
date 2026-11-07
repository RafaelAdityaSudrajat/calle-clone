// src/modules/product/product.schema.ts
import { z } from "zod";
import { ProductStatus } from "../../generated/prisma";

/**
 * Prinsip pembagian tugas:
 *  - Zod      → validasi STRUKTUR (tipe, panjang, trim, normalisasi null)
 *               → error code generik `VALIDATION_ERROR`.
 *  - Service  → business rule & state DB (404, INVALID_PRICE, INVALID_STOCK,
 *               ATTRIBUTE_REQUIRED, SKU_DUPLICATE, dst.)
 *               → error code spesifik sesuai PRD.
 */

// ─── Konstanta ────────────────────────────────────────────────────────────

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const MAX_PRODUCT_NAME = 200;
const MAX_DESCRIPTION = 5000;
const MAX_SEARCH = 100;
const MAX_SKU = 100; // VARCHAR(100)
const MAX_SIZE = 20; // VARCHAR(20)
const MAX_COLOR = 50; // VARCHAR(50)

const AT_LEAST_ONE_FIELD_MESSAGE =
  "At least one field must be provided for update";

// ─── Building blocks ──────────────────────────────────────────────────────

const uuidField = (message: string) => z.uuid({ error: message });

/** String ter-trim dengan batas panjang. Dasar untuk semua field teks. */
const trimmedText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .max(maxLength, `${field} must be at most ${maxLength} characters`);

/** Teks wajib: tidak boleh kosong setelah trim. */
const requiredText = (field: string, maxLength: number) =>
  trimmedText(field, maxLength).min(1, `${field} cannot be empty`);

const numberField = (field: string) =>
  z.number({ error: `${field} must be a number` });

/**
 * Query flag boolean ("true" | "false"), default `false`.
 *
 * JANGAN `z.coerce.boolean()`: `Boolean("false") === true` di JS, sehingga
 * `?include_deleted=false` justru meng-include data soft-deleted.
 * Nilai selain "true"/"false" (`"1"`, `"yes"`, array) → 400.
 */
const booleanQueryFlag = () =>
  z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true");

/** "" / whitespace / null / undefined → null. */
const emptyToNull = (value?: string | null) => value || null;

/**
 * Untuk partial update — membedakan tiga keadaan:
 *  - undefined → tidak dikirim, field TIDAK diubah
 *  - null / "" → field dikosongkan (null)
 *  - string    → field di-set
 * Memakai `emptyToNull` langsung akan mengubah `undefined` jadi `null`,
 * sehingga semua field yang tidak dikirim ikut ter-clear.
 */
const emptyToNullKeepUndefined = (value?: string | null) =>
  value === undefined ? undefined : emptyToNull(value);

/** Body update tidak boleh kosong (`{}` = bug klien, bukan update sah). */
const hasAtLeastOneField = (data: object) => Object.keys(data).length > 0;

const productIdParamsSchema = z.object({
  id: uuidField("id must be a valid UUID"),
});

// ─── POST /products — Create Product (FR-PM-01) ───────────────────────────

/**
 * `status`, `created_by`, `updated_by` tidak diterima dari client:
 * status selalu DRAFT (BR-03), actor diambil dari JWT (BR-26).
 *
 * `category_id` opsional: BR-24 mewajibkannya sebelum publish, bukan saat
 * create. Eksistensinya di DB dicek service (404 CATEGORY_NOT_FOUND).
 *
 * `name` memakai error function agar "tidak dikirim" (input === undefined)
 * dibedakan dari "tipe salah" (mis. number).
 */
export const createProductBodySchema = z.object({
  name: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? "name is required"
          : "name must be a string",
    })
    .trim()
    .min(1, "name cannot be empty")
    .max(
      MAX_PRODUCT_NAME,
      `name must be at most ${MAX_PRODUCT_NAME} characters`,
    ),

  description: trimmedText("description", MAX_DESCRIPTION)
    .nullish()
    .transform(emptyToNull),

  category_id: uuidField("category_id must be a valid UUID")
    .nullish()
    .transform((value) => value ?? null),
});

export const createProductSchema = {
  body: createProductBodySchema,
};

export type CreateProductInput = z.infer<typeof createProductBodySchema>;

// ─── GET /products — List Products (FR-PM-02) ─────────────────────────────

/**
 * Semua nilai query datang sebagai string, jadi angka butuh coercion.
 *
 *  - `page` / `limit`: `.int()` menolak "3.5" dan "abc". `?page=` (kosong)
 *    → 400 karena `Number("") = 0` gagal `min(1)` — strict by design.
 *  - `search`: `?search=` dan `?search=   ` menjadi `undefined` supaya
 *    service tidak menjalankan `ILIKE '%%'` (full scan tanpa manfaat).
 *  - `status`: memakai enum Prisma sebagai single source of truth.
 *  - `category_id`: hanya validasi format. Kategori yang tidak ada di DB
 *    menghasilkan list kosong, bukan error (semantik filter).
 *  - Tidak memakai `.strict()`: param asing di-strip demi forward-compat.
 *    Trade-off: typo seperti `?staus=ACTIVE` diabaikan diam-diam.
 */
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),

  search: z
    .string()
    .trim()
    .max(MAX_SEARCH, `search must be at most ${MAX_SEARCH} characters`)
    .optional()
    .transform((value) => value || undefined),

  status: z.enum(ProductStatus).optional(),

  category_id: uuidField("category_id must be a valid UUID").optional(),

  include_deleted: booleanQueryFlag(),
});

export const listProductsParamsQuerySchema = {
  query: listProductsQuerySchema,
};

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// ─── GET /products/:id — Get Product Detail (FR-PM-03) ────────────────────

/**
 * UUID divalidasi sebelum menyentuh service: bukan UUID → 400 tanpa query DB;
 * UUID valid tapi tidak ada → service yang memutuskan 404.
 */
export const getProductDetailSchema = productIdParamsSchema;

/**
 * `include_deleted` pada detail punya dua efek dalam satu flag:
 * produk soft-deleted boleh diakses, DAN varian soft-deleted ikut tampil.
 * Kalau nanti butuh granularitas, pecah di versi endpoint berikutnya.
 */
export const getProductDetailQuerySchema = z.object({
  include_deleted: booleanQueryFlag(),
});

export const getProductDetailParams = {
  params: getProductDetailSchema,
};

export const getProductDetailQuery = {
  query: getProductDetailQuerySchema,
};

export type GetProductParams = z.infer<typeof getProductDetailSchema>;
export type GetProductQuery = z.infer<typeof getProductDetailQuerySchema>;

// ─── PUT /products/:id — Update Product (FR-PM-04) ────────────────────────

export const updateProductParamsSchema = productIdParamsSchema;

/**
 * Semantik partial update: field yang tidak dikirim = tidak diubah.
 *
 * `.strict()` menolak field tak dikenal (`status`, `created_by`, `updated_by`,
 * `id`, `created_at`, `updated_at`, `deleted_at`) dengan 400. Tanpa itu,
 * `{ status: "ACTIVE" }` lolos, diabaikan service, dan client mengira produk
 * sudah dipublish. Juga defense-in-depth bila service lupa meng-pick field.
 * (Status hanya boleh berubah lewat endpoint publish/unpublish — BR-04.)
 *
 * Yang sengaja TIDAK dicek di schema (urusan service):
 *  - produk ada / tidak soft-deleted → 404
 *  - `category_id` exist di DB       → 404 CATEGORY_NOT_FOUND
 *  - race update vs soft-delete / delete kategori → `updateMany` atomik
 *    + mapping P2003; client selalu dapat 404, tidak pernah 500
 *  - concurrent update antar admin → Last Write Wins (Known Limitation #1)
 */
export const updateProductSchema = z
  .object({
    name: requiredText("name", MAX_PRODUCT_NAME).optional(),
    description: trimmedText("description", MAX_DESCRIPTION).nullish(),
    category_id: uuidField("category_id must be a valid UUID").nullish(),
  })
  .strict()
  .refine(hasAtLeastOneField, { message: AT_LEAST_ONE_FIELD_MESSAGE });

export const updateProductParams = {
  params: updateProductParamsSchema,
};

export const updateProductBody = {
  body: updateProductSchema,
};

export type UpdateProductParamsType = z.infer<typeof updateProductParamsSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ─── Variants ─────────────────────────────────────────────────────────────

/**
 * Business rule varian ditangani SERVICE agar error code PRD tetap spesifik:
 *  - price > 0          → INVALID_PRICE (BR-15)
 *  - stock >= 0         → INVALID_STOCK (BR-21)
 *  - attribute required → ATTRIBUTE_REQUIRED (BR-11)
 *  - SKU unik           → P2002 → SKU_DUPLICATE (BR-12)
 *  - kombinasi unik     → P2002 → VARIANT_DUPLICATE (BR-13)
 *
 * `size`/`color` dinormalisasi "" → null karena partial unique index
 * `(product_id, COALESCE(size,''), COALESCE(color,''))` harus melihat
 * "kosong" sebagai satu nilai yang sama.
 *
 * `price`/`stock` TIDAK di-coerce: API JSON harus mengirim number asli,
 * bukan string "100".
 */
const priceField = () =>
  numberField("price").finite("price must be a finite number");

const stockField = () => numberField("stock").int("stock must be an integer");

// ─── POST /products/:id/variants — Create Variant (FR-PM-09) ──────────────

export const createVariantBodySchema = z.object({
  sku: requiredText("sku", MAX_SKU),
  size: trimmedText("size", MAX_SIZE).nullish().transform(emptyToNull),
  color: trimmedText("color", MAX_COLOR).nullish().transform(emptyToNull),
  price: priceField(),
  stock: stockField(),
});

export const createVariantSchema = {
  body: createVariantBodySchema,
};

export type CreateVariantBodyInput = z.infer<typeof createVariantBodySchema>;

// ─── GET /products/:id/variants — List Variants (FR-PM-12) ────────────────

/**
 * Dua flag independen dan boleh dikombinasikan:
 *  - `include_deleted` → ikut tampilkan varian soft-deleted. Produk induk
 *    tetap harus aktif; kalau soft-deleted → 404 (sama seperti GET detail).
 *  - `low_stock`       → hanya varian dengan `stock < 5` (BR-23).
 */
export const listVariantsQuerySchema = z.object({
  include_deleted: booleanQueryFlag(),
  low_stock: booleanQueryFlag(),
});

export const listVariantsQuery = {
  query: listVariantsQuerySchema,
};

export type ListVariantsQuery = z.infer<typeof listVariantsQuerySchema>;

// ─── PUT /products/:id/variants/:variantId — Update Variant (FR-PM-10) ────

/**
 * Partial update, mirror dari update product: semua field optional, minimal
 * satu harus dikirim, `.strict()` menolak field terlarang (`product_id`,
 * `id`, `created_by`, `updated_by`, `deleted_at`, dst.).
 *
 * ATTRIBUTE_REQUIRED (BR-11) WAJIB dicek service terhadap merged state
 * (input + data existing): input `{ size: null }` dengan existing
 * `color = null` menghasilkan state tidak valid. Schema tidak tahu state DB.
 */
export const updateVariantBodySchema = z
  .object({
    sku: requiredText("sku", MAX_SKU).optional(),
    size: trimmedText("size", MAX_SIZE)
      .nullish()
      .transform(emptyToNullKeepUndefined),
    color: trimmedText("color", MAX_COLOR)
      .nullish()
      .transform(emptyToNullKeepUndefined),
    price: priceField().optional(),
    stock: stockField().optional(),
  })
  .strict()
  .refine(hasAtLeastOneField, { message: AT_LEAST_ONE_FIELD_MESSAGE });

/**
 * Hanya validasi FORMAT kedua UUID. Pengecekan bahwa `variantId` milik
 * `productId` (IDOR, NFR-PM-08) dilakukan di service karena butuh query DB.
 */
export const updateVariantParamsSchema = z.object({
  productId: uuidField("id must be a valid UUID"),
  variantId: uuidField("variantId must be a valid UUID"),
});

export const updateVariantParamsConfig = {
  params: updateVariantParamsSchema,
};

export const updateVariantBodyConfig = {
  body: updateVariantBodySchema,
};

export type UpdateVariantParams = z.infer<typeof updateVariantParamsSchema>;
// export type UpdateVariantBodyInput = z.infer<typeof updateVariantBodySchema>;
export type UpdateVariantBodyInput = {
  sku?: string;
  size?: string | null;
  color?: string | null;
  price?: number;
  stock?: number;
};
