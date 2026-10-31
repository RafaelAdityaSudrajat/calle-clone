import { Prisma } from "../../generated/prisma";
import { prisma } from "../../lib/prisma";
import {
  CreateProductResponse,
  ListProductsResponse,
  ProductVariantStats,
  toCreateProductResponse,
  toProductListItem,
} from "./product_v2.dto";
import { ProductErrors } from "./product_v2.errors";
import { CreateProductInput, ListProductsQuery } from "./product_v2.schema";

/**
 * Mendeteksi pelanggaran foreign-key khusus `categoryId`.
 *
 * Kenapa fungsi ini ada:
 *  - Pre-check `findUnique` memberi feedback cepat & benar untuk kasus umum.
 *  - Di antara pre-check dan insert, admin lain bisa menghapus kategori.
 *    FK DB (`ON DELETE RESTRICT`) akan menolak insert dengan P2003,
 *    sehingga integritas data tetap terjaga. Tanpa mapping ini, client
 *    akan menerima `VALIDATION_ERROR` (400) generik — padahal kontrak
 *    API mewajibkan `CATEGORY_NOT_FOUND` (404).
 *
 * Strategi pencocokan:
 *  - `err.code === "P2003"` — kegagalan foreign-key constraint.
 *  - Cek `field_name` atau `constraint` di meta. Prisma mengisi `field_name`
 *    untuk pelanggaran FK (`Product_categoryId_fkey`); kita cek keduanya
 *    sebagai defensive terhadap perbedaan versi Prisma minor.
 *  - Regex `/category/i` — kalau nanti `Product` punya FK lain (mis. relasi
 *    entitas baru), kita hanya menangkap pelanggaran FK kategori di sini.
 *    P2003 lain akan diteruskan ke error handler generik.
 */

function isCategoryFkViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2003") return false;
  const meta = err.meta ?? {};
  const target = String(meta.field_name ?? meta.constraint ?? "");
  return /category/i.test(target);
}

/**
 * FR-PM-01 — Buat produk.
 *
 * Kontrak:
 *  - `name` wajib, `description` opsional, `category_id` opsional.
 *  - Status dipaksa `DRAFT` (BR-03) — tidak bisa di-override client.
 *  - `created_by` / `updated_by` diambil dari admin yang terautentikasi (BR-26).
 *  - Kategori (jika dikirim) harus ada → 404 `CATEGORY_NOT_FOUND`.
 *
 * Penanganan race condition:
 *  - Pre-check `findUnique` menangani kasus normal (cepat, pesan jelas).
 *  - Kalau kategori dihapus di antara cek dan insert, FK RESTRICT
 *    menolak write (P2003). Kita map error itu ke `CATEGORY_NOT_FOUND`
 *    yang sama, supaya client selalu menerima error konsisten terlepas
 *    dari timing.
 *  - Tidak pakai `$transaction` di sini: single write, dan transaksi
 *    tidak akan menyelesaikan race ini tanpa naik ke isolasi `Serializable`
 *    (overkill untuk MVP). NFR-PM-01 berlaku untuk write multi-tabel
 *    (variant, publish, image) — bukan endpoint ini.
 *
 * @throws {AppError} CATEGORY_NOT_FOUND — `category_id` dikirim tapi tidak ada.
 * @throws {AppError} INTERNAL_ERROR — error DB yang tidak terduga.
 */
export async function createProductService(
  input: CreateProductInput,
  adminId: string,
): Promise<CreateProductResponse> {
  // Fast path: fail early with a clear error for the common case.
  if (input.category_id) {
    const categoryExists = await prisma.category.findUnique({
      where: { id: input.category_id },
      select: { id: true },
    });
    if (!categoryExists) throw ProductErrors.categoryNotFound();
  }

  try {
    const row = await prisma.product.create({
      data: {
        name: input.name,
        description: input.description,
        categoryId: input.category_id,
        status: "DRAFT",
        createdBy: adminId,
        updatedBy: adminId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        categoryId: true,
        status: true,
        createdBy: true,
        createdAt: true,
      },
    });

    return toCreateProductResponse(row);
  } catch (err) {
    // Race path: kalau insert gagal karena FK dan kategori memang sudah tidak ada.
    if (input.category_id && (err as any)?.code === "P2003") {
      const stillExists = await prisma.category.findUnique({
        where: { id: input.category_id },
        select: { id: true },
      });
      if (!stillExists) throw ProductErrors.categoryNotFound();
    }
    throw err;
  }
}

/**
 * Susun WHERE clause untuk list produk dari query tervalidasi.
 *
 * Aturan:
 *  - Default menyembunyikan produk soft-deleted (BR-05).
 *  - `include_deleted=true` menampilkan SEMUA (live + soft-deleted) —
 *    dipakai admin untuk audit/recovery. Restore out of scope MVP.
 *  - `status` filter independen dari `include_deleted`.
 *  - `search` mencocokkan nama produk ATAU SKU varian aktif
 *    (DD-PM-14). Varian soft-deleted tidak ikut supaya pencarian
 *    mencerminkan inventory yang masih dijual.
 *  - `mode: 'insensitive'` → Postgres ILIKE (NFR-PM-13).
 *
 * Keamanan:
 *  - Seluruh nilai user di-parameterize Prisma → tidak ada SQL injection.
 *  - Karakter `%` / `_` di input DIPERLAKUKAN sebagai wildcard SQL LIKE.
 *    Ini bukan celah keamanan (input tetap ter-bind), tapi bisa
 *    menghasilkan false-positive. Mis. search `"50%"` akan cocok
 *    ke `"50"`, `"500"`, dst. Untuk MVP diterima; kalau perlu escape,
 *    gunakan raw query dengan `ESCAPE` clause.
 */
function buildListWhere(query: ListProductsQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (!query.include_deleted) {
    where.deletedAt = null;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.category_id) {
    where.categoryId = query.category_id;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      {
        variants: {
          some: {
            sku: { contains: query.search, mode: "insensitive" },
            deletedAt: null,
          },
        },
      },
    ];
  }

  return where;
}

export async function getListProductService(
  query: ListProductsQuery,
): Promise<ListProductsResponse> {
  const where = buildListWhere(query);
  const skip = (query.page - 1) * query.limit;

  return prisma.$transaction(
    async (tx) => {
      // Query 1: baris halaman ini.
      // `select` subset — hanya field yang dipakai DTO.
      // `images.take: 1` aman karena partial unique index di
      // (`product_id`) WHERE `is_primary = true` menjamin ≤ 1 baris.
      const rows = await tx.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true },
          },
        },
      });

      // Query 2: total terfilter (independen dari page/limit).
      const total = await tx.product.count({ where });

      // Query 3: stats varian aktif untuk halaman ini.
      // Varian soft-deleted dikecualikan (BR-14).
      // Guard `length === 0` menghindari round-trip sia-sia
      // saat page melewati total.
      const productIds = rows.map((r) => r.id);
      const statsRows =
        productIds.length === 0
          ? []
          : await tx.productVariant.groupBy({
              by: ["productId"],
              where: { productId: { in: productIds }, deletedAt: null },
              _sum: { stock: true },
              _count: { _all: true },
            });

      const statsByProductId = new Map<string, ProductVariantStats>(
        statsRows.map((s) => [
          s.productId,
          { count: s._count._all, stock: s._sum.stock ?? 0 },
        ]),
      );

      const items = rows.map((row) =>
        toProductListItem(row, statsByProductId.get(row.id)),
      );

      return {
        items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          total_pages: Math.ceil(total / query.limit),
        },
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    },
  );
}
