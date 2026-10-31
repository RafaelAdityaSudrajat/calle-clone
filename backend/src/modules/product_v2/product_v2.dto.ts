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
