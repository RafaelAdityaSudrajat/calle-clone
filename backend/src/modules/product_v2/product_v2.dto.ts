// src/modules/product/product.dto.ts
import type { ProductStatus } from "../../generated/prisma";

/**
 * FR-PM-01 — Response 201 untuk POST /products.
 *
 * Bentuk mengikuti API Contract apa adanya. Nama field pakai snake_case
 * karena itu kontrak API publik — camelCase milik Prisma (`categoryId`,
 * `createdBy`) adalah detail internal yang tidak boleh bocor ke client.
 *
 * Catatan:
 *  - `status` bertipe `ProductStatus` (enum Prisma), tapi untuk create
 *    nilainya selalu `"DRAFT"` (BR-03). Tipe tetap enum supaya DTO ini
 *    reusable kalau nanti flow lain memakai shape yang sama.
 *  - `created_at` adalah string ISO-8601 (JSON tidak bisa serialize `Date`).
 *    Konversi dilakukan oleh mapper, bukan konsumen DTO.
 *  - Tidak ada `updated_at` / `updated_by`: tidak ada di kontrak untuk
 *    create. Menambah field nanti adalah breaking change, jadi kita
 *    jaga DTO tetap minimal & setia ke kontrak.
 */
export interface CreateProductResponse {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  status: ProductStatus;
  created_by: string;
  created_at: string;
}

/**
 * Input untuk mapper. Sengaja interface lokal — bukan `Product` dari Prisma —
 * supaya layer DTO terpisah dari tipe ORM. Service cukup passing row hasil
 * `select` yang cocok dengan shape ini; test bisa membuat object-nya
 * tanpa meng-import Prisma.
 */
interface ProductRowForCreate {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  status: ProductStatus;
  createdBy: string;
  createdAt: Date;
}

/**
 * Mapper: row Prisma → DTO response API.
 *
 * Diletakkan di sini (bukan di service) supaya:
 *  - Rename field (camelCase → snake_case) terpusat di satu tempat.
 *  - Unit test untuk mapper simpel & tidak tergantung DB.
 *  - Nambah field nanti cukup sentuh satu tempat.
 */
export function toCreateProductResponse(
  row: ProductRowForCreate,
): CreateProductResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category_id: row.categoryId,
    status: row.status,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

// ----------------------------------------------------------------

/**
 * Satu item dalam list produk (FR-PM-02).
 *
 * - `variant_count` & `total_stock` dihitung dari varian AKTIF saja
 *   (`deletedAt IS NULL`) — varian soft-deleted tidak dihitung sebagai
 *   inventory yang bisa dijual (BR-14).
 * - `primary_image_url` bisa null untuk DRAFT yang belum upload gambar
 *   (BR-18 hanya wajib saat publish).
 * - `category` bisa null untuk DRAFT yang belum dikategorikan (BR-24
 *   mewajibkan kategori sebelum publish, bukan saat create).
 */
export interface ProductListItem {
  id: string;
  name: string;
  category: { id: string; name: string } | null;
  status: ProductStatus;
  primary_image_url: string | null;
  variant_count: number;
  total_stock: number;
  created_at: string;
  updated_at: string;
}

export interface ListPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListProductsResponse {
  items: ProductListItem[];
  pagination: ListPagination;
}

/**
 * Input mapper. Sengaja interface lokal, bukan tipe Prisma — supaya
 * layer DTO tidak terikat ke ORM dan mapper bisa di-unit-test tanpa
 * Prisma runtime.
 */
export interface ProductListRow {
  id: string;
  name: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string } | null;
  images: { url: string }[];
}

export interface ProductVariantStats {
  count: number;
  stock: number;
}

export function toProductListItem(
  row: ProductListRow,
  stats: ProductVariantStats | undefined,
): ProductListItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    primary_image_url: row.images[0]?.url ?? null,
    variant_count: stats?.count ?? 0,
    total_stock: stats?.stock ?? 0,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * Threshold untuk flag `low_stock` (BR-23).
 * Diekspor supaya service & test konsisten — kalau nanti nilainya
 * dikonfigurasi (per kategori, per produk), tinggal ubah di satu tempat.
 */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Satu varian di nested response detail produk (FR-PM-03).
 *
 * - `price` dikirim sebagai number (bukan Decimal string). Prisma
 *   mengembalikan Decimal; mapper yang mengonversi via Number().
 *   Untuk harga Rupiah, presisi Decimal(12,2) aman di number JS
 *   (max 9.9e10, jauh di atas harga fashion). Kalau nanti ada
 *   kebutuhan presisi total, kirim sebagai string — ubah DTO saat itu.
 * - `low_stock` dihitung dari `stock < LOW_STOCK_THRESHOLD` (BR-23).
 *   Sengaja tidak dari DB — ini derived value, bukan state.
 * - `deleted_at` selalu ada (null untuk varian aktif). Klien yang
 *   meminta `?include_deleted=true` butuh tahu mana yang sudah
 *   dihapus untuk audit.
 */

export interface VariantDetail {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
  low_stock: boolean;
  deleted_at: string | null;
}

// ─── Image ──────────────────────────────────────────────────────

/**
 * Satu gambar di nested response detail produk (FR-PM-03).
 *
 * - `url` + `is_primary` + `sort_order` saja. `file_key` sengaja
 *   disembunyikan: itu path storage internal (Cloudinary public_id),
 *   bukan informasi untuk klien. Bocor = memperbesar attack surface.
 * - Tidak ada `created_by` / `created_at`: tidak di kontrak.
 */
export interface ImageDetail {
  id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

// ─── Product detail ─────────────────────────────────────────────

export interface ProductDetailResponse {
  id: string;
  name: string;
  description: string | null;
  category: { id: string; name: string } | null;
  status: ProductStatus;
  variants: VariantDetail[];
  images: ImageDetail[];
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Mapper row shapes ─────────────────────────────────────────

/**
 * Row shapes — interface lokal, decoupled dari Prisma.
 * Service meng-passing hasil `select` yang cocok dengan shape ini;
 * test bisa membuat object-nya tanpa Prisma runtime.
 */
export interface ProductDetailRow {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    price: { toString(): string } | number; // Prisma Decimal | number
    stock: number;
    deletedAt: Date | null;
  }>;
  images: Array<{
    id: string;
    url: string;
    isPrimary: boolean;
    sortOrder: number;
  }>;
}

// ─── Mapper ────────────────────────────────────────────────────

export function toVariantDetail(
  row: ProductDetailRow["variants"][number],
): VariantDetail {
  return {
    id: row.id,
    sku: row.sku,
    size: row.size,
    color: row.color,
    price: Number(row.price.toString()),
    stock: row.stock,
    low_stock: row.stock < LOW_STOCK_THRESHOLD,
    deleted_at: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export function toImageDetail(
  row: ProductDetailRow["images"][number],
): ImageDetail {
  return {
    id: row.id,
    url: row.url,
    is_primary: row.isPrimary,
    sort_order: row.sortOrder,
  };
}

export function toProductDetailResponse(
  row: ProductDetailRow,
): ProductDetailResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    variants: row.variants.map(toVariantDetail),
    images: row.images.map(toImageDetail),
    created_by: row.createdBy,
    updated_by: row.updatedBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

// src/modules/product/product.dto.ts (tambahan di bawah DTO detail)

/**
 * FR-PM-04 — Response 200 untuk PUT /products/:id.
 *
 * Shape mengikuti API Contract PERSIS (hanya 4 field):
 *   { id, name, updated_by, updated_at }
 *
 * Kenapa minimal:
 *  - Kontrak API mendefinisikan response sesempit ini — klien yang
 *    butuh field lain (description, category, status) tinggal GET
 *    detail setelah PUT. Ini pola yang umum & menjaga payload kecil.
 *  - Menambah field di response PUT adalah breaking change (klien
 *    mungkin assert `Object.keys(data).length === 4`). Simpan minimal
 *    sampai ada kebutuhan konkret.
 *
 * Kenapa `updated_by` & `updated_at` WAJIB ada:
 *  - BR-26: audit trail minimal (siapa ubah apa, kapan). Klien bisa
 *    langsung menampilkan "Diubah oleh X pada Y" tanpa GET tambahan.
 *  - Tanpa field ini, klien harus GET ulang detail → 2 round-trip
 *    untuk 1 operasi tulis.
 *
 * Kenapa TIDAK ada `created_at` / `created_by`:
 *  - Tidak berubah saat PUT. Menyertakannya redundan — kalau klien
 *    butuh, tinggal GET detail.
 */
export interface UpdateProductResponse {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  status: ProductStatus;
  updated_by: string;
  updated_at: string;
}

/**
 * Input mapper — interface lokal, decoupled dari Prisma.
 *
 * Sengaja TIDAK memakai `Product` dari Prisma (full row) karena:
 *  - Mapper hanya butuh 4 field; menyatakan hanya 4 field membuat
 *    kontrak mapper eksplisit & mudah di-unit-test.
 *  - Kalau suatu saat kolom `Product` bertambah, mapper tidak
 *    terpengaruh (tidak ada risiko aksidental mengakses field
 *    yang tidak boleh di-expose).
 *  - Test bisa membuat object kecil ini tanpa import Prisma runtime.
 *
 * Service akan fetch row setelah `updateMany` sukses (karena
 * `updateMany` mengembalikan `count`, bukan row). `findUnique({ id })`
 * SETELAH update tetap aman meski produk di-soft-delete di antara
 * keduanya — row tidak terhapus fisik (BR-05), dan itu murni
 * race "Last Write Wins" yang terdokumentasi (Known Limitation #1).
 * Klien tetap dapat 200 dengan data terbaru — sama seperti dua admin
 * edit bersamaan.
 */
export interface ProductRowForUpdate {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  status: ProductStatus;
  updatedBy: string;
  updatedAt: Date;
}
/**
 * Mapper: row Prisma → DTO response PUT.
 *
 * Konversi:
 *  - `updatedBy` → `updated_by` (snake_case untuk API publik).
 *  - `updatedAt` (`Date`) → `string` ISO-8601 (JSON tidak serialize Date).
 *
 * Tidak ada konversi `Decimal` di sini — DTO PUT tidak expose `price`
 * (harga di level varian; bukan tanggung jawab PUT product).
 */
export function toUpdateProductResponse(
  row: ProductRowForUpdate,
): UpdateProductResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category_id: row.categoryId,
    status: row.status,
    updated_by: row.updatedBy,
    updated_at: row.updatedAt.toISOString(),
  };
}

// PUBLISH ENDPOINT DTO
export interface PublishProductResponse {
  id: string;
  status: "ACTIVE";
}

export interface UnpublishProductResponse {
  id: string;
  status: "INACTIVE";
}

export type RepublishProductResponse = PublishProductResponse;
