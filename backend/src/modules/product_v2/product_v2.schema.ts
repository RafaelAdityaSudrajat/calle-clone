// src/modules/product/product.schema.ts
import { z } from "zod";
import { ProductStatus } from "../../generated/prisma";

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
