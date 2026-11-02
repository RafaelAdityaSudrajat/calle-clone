// src/modules/product/product.schema.ts
import { z } from "zod";
import { ProductStatus } from "../../generated/prisma";

//products — Create Product

/**
 * FR-PM-01 — Create product payload (Zod v4).
 *
 * - `status`, `created_by`, `updated_by` tidak diterima dari client:
 *   status selalu DRAFT (BR-03), actor diambil dari JWT (BR-26).
 * - `category_id` opsional: BR-24 "wajib diisi sebelum publish", bukan saat create.
 *   Kalau dikirim, harus UUID & exist di DB (404 CATEGORY_NOT_FOUND) — dicek di service.
 * - `description` dinormalisasi: "" / whitespace / null / undefined → null.
 *
 * Zod v4: `required_error` & `invalid_type_error` sudah dihapus, diganti `error`.
 * Function form dipakai untuk `name` karena butuh membedakan "tidak dikirim"
 * (input === undefined) vs "tipe salah" (mis. number).
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
    .max(200, "name must be at most 200 characters"),

  description: z
    .string({ error: "description must be a string" })
    .trim()
    .max(5000, "description must be at most 5000 characters")
    .nullish()
    .transform((v) => v || null),

  category_id: z
    .uuid({ error: "category_id must be a valid UUID" })
    .nullish()
    .transform((v) => v ?? null),
});

export const createProductSchema = {
  body: createProductBodySchema,
};

export type CreateProductInput = z.infer<typeof createProductBodySchema>;

//products — List Products

/**
 * FR-PM-02 — Query params untuk GET /products.
 *
 * Semua nilai datang sebagai string dari Express (atau undefined),
 * jadi field numerik & boolean butuh coercion eksplisit.
 *
 * Keputusan per field:
 *
 * ── page & limit ────────────────────────────────────────────────
 *  - `z.coerce.number()` — `"3"` → 3.
 *  - `.int()` — menolak `"3.5"` dan `"abc"` (NaN) sebelum sampai service.
 *  - `page` default 1, min 1 (page 0 tidak masuk akal untuk OFFSET).
 *  - `limit` default 10 (kontrak), max 100 (kontrak — cegah payload
 *    raksasa & query mahal).
 *  - Trade-off: `?page=` (string kosong) → 400 karena `Number("") = 0`
 *    gagal `min(1)`. Ini strict-by-design; klien yang mengirim kosong
 *    memang salah. Kalau nanti ditemukan klien yang selalu kirim kosong,
 *    tambahkan preprocess `(v) => (v === "" ? undefined : v)`.
 *
 * ── search ──────────────────────────────────────────────────────
 *  - `.trim()` dulu, baru `.max(100)`: input 102 char dengan spasi jadi
 *    99 char setelah trim, lolos — sesuai maksud user.
 *  - `.transform(v => v || undefined)`: `?search=` dan `?search=   `
 *    menjadi `undefined`, sehingga service **tidak** menjalankan
 *    `ILIKE '%%'` yang memindai seluruh tabel tanpa manfaat.
 *  - Maks 100 char: guard terhadap payload pencarian yang tidak masuk
 *    akal, sekaligus membatasi cost `ILIKE` di sisi DB.
 *
 * ── status ──────────────────────────────────────────────────────
 *  - Pakai enum Prisma `ProductStatus` — source of truth tunggal.
 *    Kalau suatu saat ada status baru, tidak perlu ubah schema ini.
 *  - Zod v4: `z.enum()` menerima const object (pengganti `z.nativeEnum()`
 *    v3). Prisma meng-generate `ProductStatus` sebagai const object,
 *    jadi cocok langsung.
 *
 * ── category_id ─────────────────────────────────────────────────
 *  - UUID valid atau tidak dikirim. Kalau dikirim tapi tidak ada di DB,
 *    bukan urusan schema — service yang memutuskan (list dengan
 *    kategori kosong = list kosong, bukan error; beda dengan create
 *    yang 404). Ini konsisten dengan semantik filter.
 *
 * ── include_deleted ─────────────────────────────────────────────
 *  - JANGAN pakai `z.coerce.boolean()`: di JS `Boolean("false") === true`
 *    — bug klasik yang membuat `?include_deleted=false` justru
 *    meng-*include* produk yang soft-deleted.
 *  - Pakai `z.enum(["true", "false"])` — hanya dua nilai yang diterima.
 *    Nilai lain (`"1"`, `"yes"`, array) ditolak 400. Strict by design.
 *  - Default `"false"` → setelah transform jadi `false` (boolean).
 *  - Setelah `.parse()`, field ini bertipe `boolean` di service,
 *    bukan string. Service cukup `if (query.include_deleted)`.
 *
 * ── Tidak pakai `.strict()` ─────────────────────────────────────
 *  - Parameter asing di-strip (perilaku default Zod).
 *  - Trade-off: typo seperti `?staus=ACTIVE` akan silently diabaikan
 *    (hasil tanpa filter status) — membingungkan UX, tapi menjaga
 *    forward-compat (klien boleh kirim param tambahan seperti `_t`).
 *  - Kalau kamu lebih suka strict (reject typo), tambahkan `.strict()`.
 *    Keputusan policy, bukan correctness.
 */
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z
    .string()
    .trim()
    .max(100, "search must be at most 100 characters")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  status: z.enum(ProductStatus).optional(),

  category_id: z.uuid({ error: "category_id must be a valid UUID" }).optional(),

  include_deleted: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

export const listProductsParamsQuerySchema = {
  query: listProductsQuerySchema,
};

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

//products/:id — Get Product Detail

/**
 * FR-PM-03 — Path param untuk GET /products/:id.
 *
 * `id` divalidasi sebagai UUID sebelum menyentuh service:
 *  - Bukan UUID → 400 `VALIDATION_ERROR` (cepat, tidak query DB).
 *  - UUID valid tapi tidak ada → service yang memutuskan 404.
 *  - Ini mencegah sampling/scanning endpoint dengan string acak.
 *
 * Format UUID: Zod 4 memakai regex RFC 4122 — menerima versi 1–8
 * termasuk UUID v4 yang di-generate Prisma (`@default(uuid())`).
 * Perhatikan: `z.uuid()` di v4 strict terhadap hex + dash; string
 * seperti `"not-a-uuid"`, `"123"`, atau UUID uppercase semuanya
 * ditolak (UUID uppercase tidak dikirim Prisma).
 */
export const getProductDetailSchema = z.object({
  id: z.uuid({ error: "id must be a valid UUID" }),
});

/**
 * FR-PM-03 — Query params untuk GET /products/:id.
 *
 * `include_deleted` di detail berbeda maknanya dari list:
 *  - LIST:   `true` = tampilkan produk soft-deleted juga (semua status).
 *  - DETAIL: `true` = boleh akses produk soft-deleted, DAN tampilkan
 *            varian soft-deleted di nested response.
 *
 * Kenapa satu flag untuk dua perilaku:
 *  - Konsisten dengan API Contract (`?include_deleted=true` untuk lihat
 *    varian soft-deleted).
 *  - FR-PM-03: "Kalau produk soft-deleted → 404 kecuali `?include_deleted=true`".
 *  - Kalau suatu saat butuh granularitas (mis. `?include_deleted=variants`
 *    saja tanpa buka produk yang sudah diarsip), tinggal pecah flag
 *    di versi endpoint berikut. Jangan over-engineer sekarang.
 *
 * Parsing: JANGAN `z.coerce.boolean()` — `Boolean("false") === true`
 * di JS. Pakai `enum(["true", "false"])` supaya hanya dua nilai yang
 * diterima. Nilai lain (`"1"`, `"yes"`, array) → 400.
 */
export const getProductDetailQuerySchema = z.object({
  include_deleted: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

export const getProductDetailParams = {
  params: getProductDetailSchema,
};

export const getProductDetailQuery = {
  query: getProductDetailQuerySchema,
};

export type GetProductParams = z.infer<typeof getProductDetailSchema>;
export type GetProductQuery = z.infer<typeof getProductDetailQuerySchema>;

//products/:id — Update Product

/**
 * FR-PM-04 — Path param untuk PUT /products/:id.
 *
 * Sama seperti `getProductParamsSchema`: UUID divalidasi sebelum
 * menyentuh service. Bukan UUID → 400 `VALIDATION_ERROR` tanpa query DB
 * (mencegah sampling/scanning endpoint). UUID valid tapi tidak ada → service.
 */
export const updateProductParamsSchema = z.object({
  id: z.uuid({ error: "id must be a valid UUID" }),
});

/**
 * FR-PM-04 — Body untuk PUT /products/:id.
 *
 * Semantik partial update (mirip PATCH), tapi endpoint-nya PUT sesuai
 * kontrak PRD. Field yang tidak dikirim = tidak diubah.
 *
 * Field yang DIIZINKAN (dari FR-PM-04):
 *  - `name`        — optional; kalau dikirim harus non-empty setelah trim.
 *  - `description` — nullish; `null`/`""` → dikosongkan, string → di-set.
 *  - `category_id` — nullish; `null` → dikosongkan, UUID → di-set (harus exist).
 *
 * ── Kenapa `.strict()` (dan bukan default strip) ───────────────────
 *
 * Default Zod men-strip field tak dikenal → `{ status: "ACTIVE" }`
 * akan lolos parse, service mengabaikannya, client dapat 200 dengan
 * `status: DRAFT` — membingungkan dan menyalahi ekspektasi (client
 * mengira sudah publish).
 *
 * `.strict()` menolak field tak dikenal → 400 dengan pesan eksplisit.
 * Ini juga defense-in-depth: kalau suatu saat service lupa pick field
 * dan mengoper `req.body` mentah ke Prisma, `status` tidak akan
 * "nyelip" ke update — request sudah ditolak duluan di schema.
 *
 * Field yang otomatis ditolak `.strict()`:
 *  - `status`                → wajib lewat endpoint publish/unpublish (BR-04)
 *  - `created_by`            → actor ditentukan server (BR-26)
 *  - `updated_by`            → actor ditentukan server (BR-26)
 *  - `id`                    → read-only, dari URL bukan body
 *  - `created_at`, `updated_at`, `deleted_at` → kolom sistem
 *
 * Trade-off: klien tidak bisa kirim field tambahan (mis. `_meta`).
 * Untuk endpoint mutasi admin, ini perilaku yang diinginkan — jika
 * nanti butuh field tambahan, tambahkan ke schema secara eksplisit.
 *
 * ── Kenapa `.refine()` mewajibkan minimal 1 field ───────────────────
 *
 * Body `{}` adalah bug klien, bukan update sah. Tanpa refine:
 *  - Service akan update `updatedBy` saja (no-op dari sisi bisnis).
 *  - Client dapat 200 dengan data tak berubah — bisa dianggap sukses
 *    padahal tidak ada yang berubah. Membingungkan.
 * Dengan refine: 400 dengan pesan jelas, feedback instan.
 *
 * ── Yang TIDAK dilakukan schema (dan kenapa) ────────────────────────
 *
 * Schema hanya memvalidasi BENTUK input, tidak memeriksa state produk:
 *  - Apakah produk ada & tidak soft-deleted? → service (404).
 *  - Apakah `category_id` benar-benar exist di DB? → service (404).
 *  - Race pre-check vs FK? → service (P2003 mapping).
 *  - Last Write Wins? → keputusan desain (Known Limitation #1).
 *
 * Dengan memisahkan concern ini, schema bisa di-unit-test tanpa DB
 * dan service bisa di-test tanpa parsing HTTP.
 *
 * ── Catatan race condition yang akan di-handle SERVICE ──────────────
 *
 * 1. Concurrent update dua admin → Last Write Wins (dokumentasi).
 *    Tidak mungkin dicegah schema; ini konsekuensi PUT idempotent.
 * 2. Update vs soft-delete concurrent:
 *    - `updateMany({ where: { id, deletedAt: null } })` → atomik.
 *    - Kalau soft-delete commit lebih dulu → count=0 → 404.
 *    - Kalau update commit lebih dulu → count=1, lalu soft-delete
 *      terjadi, client dapat 200 (Last Write Wins).
 * 3. Update `category_id` vs delete kategori concurrent:
 *    - Pre-check kategori → lolos (masih ada).
 *    - Delete kategori commit.
 *    - UpdateMany dengan `categoryId` lama → P2003 dari DB → catch
 *      → 404 `CATEGORY_NOT_FOUND`.
 *    Semua jalur konsisten: client dapat 404, tidak pernah 500.
 */
export const updateProductSchema = z
  .object({
    name: z
      .string({ error: "name must be a string" })
      .trim()
      .min(1, "name cannot be empty")
      .max(200, "name must be at most 200 characters")
      .optional(),

    description: z
      .string({ error: "description must be a string" })
      .trim()
      .max(5000, "description must be at most 5000 characters")
      .nullish(),

    category_id: z
      .uuid({ error: "category_id must be a valid UUID" })
      .nullish(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update",
  });

export const updateProductParams = {
  params: updateProductParamsSchema,
};

export const updateProductBody = {
  body: updateProductSchema,
};

export type UpdateProductParamsType = z.infer<typeof updateProductParamsSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// src/modules/product_v2/product_v2.schema.ts (tambahan)

/**
 * FR-PM-09 — Body untuk POST /products/:id/variants.
 *
 * Zod menangani STRUKTUR (tipe, panjang, trim, normalisasi null).
 * Business rules (price > 0, stock >= 0, attribute required) DITANGANI
 * SERVICE — supaya error code spesifik dari PRD (INVALID_PRICE,
 * INVALID_STOCK, ATTRIBUTE_REQUIRED) bisa di-throw, bukan
 * VALIDATION_ERROR generik dari Zod.
 *
 * Ini konsisten dengan pattern project:
 *  - Zod → VALIDATION_ERROR (format input salah)
 *  - Service → code spesifik (business rule violated)
 *
 * ── Field mapping ke constraint DB ─────────────────────────────────
 *
 *   sku    VARCHAR(100) NOT NULL UNIQUE
 *   size   VARCHAR(20)  NULL
 *   color  VARCHAR(50)  NULL
 *   price  DECIMAL(12,2) NOT NULL CHECK (price > 0)
 *   stock  INTEGER      NOT NULL DEFAULT 0 CHECK (stock >= 0)
 *
 * Zod max-length di sini mencegah insert gagal dengan P2000
 * (column too long) — gagal di validation layer, bukan DB layer.
 *
 * ── Transformasi ─────────────────────────────────────────────────
 *
 *  - sku: trim → min(1) — mencegah "   " lolos sebagai SKU
 *  - size/color: trim → "" → null — normalisasi untuk partial unique
 *    index `(product_id, COALESCE(size,''), COALESCE(color,''))`.
 *    Kalau kita simpan "" (empty string), partial unique index akan
 *    menganggap "" sebagai nilai berbeda dari null, padahal
 *    semantiknya sama-sama "tidak ada". Selalu normalize ke null.
 *  - price/stock: tidak di-coerce — input harus benar-benar number.
 *    `z.coerce.number()` akan terima "100" (string) → tidak diinginkan
 *    untuk API JSON. Client harus kirim number.
 *
 * ── Yang TIDAK divalidasi di sini (kenapa) ────────────────────────
 *
 *  - price > 0          → service (INVALID_PRICE per BR-15)
 *  - stock >= 0         → service (INVALID_STOCK per BR-21)
 *  - attribute required → service (ATTRIBUTE_REQUIRED per BR-11)
 *  - SKU uniqueness     → service + DB (P2002 → SKU_DUPLICATE)
 *  - kombinasi unique   → service + DB (P2002 → VARIANT_DUPLICATE)
 *
 * Duplikasi validasi di Zod akan mengubah code yang dilihat klien —
 * tidak diinginkan untuk kontrak API.
 */
export const createVariantBodySchema = z.object({
  sku: z
    .string({ error: "sku must be a string" })
    .trim()
    .min(1, "sku cannot be empty")
    .max(100, "sku must be at most 100 characters"),

  size: z
    .string({ error: "size must be a string" })
    .trim()
    .max(20, "size must be at most 20 characters")
    .nullish()
    // Normalisasi: "" / whitespace → null. Mencegah partial unique
    // index memperlakukan "" berbeda dari null.
    .transform((v) => (v && v.length > 0 ? v : null)),

  color: z
    .string({ error: "color must be a string" })
    .trim()
    .max(50, "color must be at most 50 characters")
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),

  price: z
    .number({ error: "price must be a number" })
    // `.finite()` menolak NaN & Infinity — bukan error bisnis
    // (INVALID_PRICE), tapi error format (VALIDATION_ERROR).
    .finite("price must be a finite number"),

  stock: z
    .number({ error: "stock must be a number" })
    // `.int()` menolak 5.5 dst — stok selalu unit bulat. Bukan
    // INVALID_STOCK (yang berarti negatif), tapi VALIDATION_ERROR.
    .int("stock must be an integer"),
});

export const createVariantSchema = {
  body: createVariantBodySchema,
};

export type CreateVariantBodyInput = z.infer<typeof createVariantBodySchema>;
