import { Prisma } from "../../generated/prisma";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import {
  CreateProductResponse,
  CreateVariantResponse,
  ListProductsResponse,
  ListVariantsResponse,
  LOW_STOCK_THRESHOLD,
  LowStockListResponse,
  ProductDetailResponse,
  ProductVariantStats,
  PublishProductResponse,
  RepublishProductResponse,
  toCreateProductResponse,
  toCreateVariantResponse,
  toLowStockVariantItem,
  toProductDetailResponse,
  toProductListItem,
  toUpdateProductResponse,
  toUpdateStockResponse,
  toVariantDetail,
  UnpublishProductResponse,
  UpdateProductResponse,
  UpdateStockResponse,
  UpdateVariantResponse,
  VariantListItem,
} from "./product_v2.dto";
import { ProductErrors } from "./product_v2.errors";
import {
  CreateProductInput,
  CreateVariantBodyInput,
  GetProductQuery,
  ListProductsQuery,
  ListVariantsQuery,
  UpdateProductInput,
  UpdateVariantBodyInput,
} from "./product_v2.schema";

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

interface PublishSnapshot {
  id: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  categoryId: string | null;
  variants: Array<{ id: string; price: unknown }>;
  images: Array<{ id: string; isPrimary: boolean }>;
}

interface PublishFailure {
  code: string;
  message: string;
}

type PublishEntryStatus = "DRAFT" | "INACTIVE";

// ── Helper: read snapshot ──────────────────────────────────────────
// Query dipisah (bukan inline) karena dipakai 2x:
//   1. Initial read (advisory) — untuk friendly multi-error cepat.
//   2. Re-read (disambiguasi) — setelah `$executeRaw` affected=0,
//      untuk menghasilkan error yang akurat terhadap state SEKARANG,
//      bukan state lama yang sudah basi.
//
// `variants.deletedAt: null` di nested where → varian soft-deleted
// tidak ikut dihitung (BR-14).
export async function readPublishSnapshot(
  id: string,
): Promise<PublishSnapshot | null> {
  return prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      status: true,
      categoryId: true,
      variants: {
        where: { deletedAt: null },
        select: { id: true, price: true },
      },
      images: {
        select: { id: true, isPrimary: true },
      },
    },
  });
}

// ── Helper: validasi BR-07 ─────────────────────────────────────────
// Mengumpulkan SEMUA kegagalan (bukan throw di yang pertama) —
// BR-08 + EC-PM-B6: admin bisa perbaiki semua sekaligus.
//
// Urutan stabil untuk test & UX:
//   1. PRODUCT_NEEDS_VARIANT       (fondasi)
//   2. INVALID_PRICE               (properti varian)
//   3. PRODUCT_NEEDS_IMAGE         (kebutuhan visual)
//   4. PRODUCT_NEEDS_PRIMARY_IMAGE (turunan)
//   5. CATEGORY_REQUIRED           (metadata)
export function collectPublishFailures(
  snapshot: PublishSnapshot,
): PublishFailure[] {
  const failures: PublishFailure[] = [];

  // 1. Minimal 1 varian aktif
  if (snapshot.variants.length === 0) {
    failures.push({
      code: "PRODUCT_NEEDS_VARIANT",
      message: "Product must have at least 1 active variant",
    });
  }

  // 2. Semua harga > 0
  //    `Number()` untuk handle Prisma Decimal & number. DB sudah punya
  //    CHECK (price > 0) — guard defensive terhadap bypass / bug input.
  //    Perbandingan authoritative tetap dilakukan Postgres di WHERE
  //    `$executeRaw` (presisi DECIMAL penuh).
  if (snapshot.variants.some((v) => Number(v.price) <= 0)) {
    failures.push({
      code: "INVALID_PRICE",
      message: "All active variant prices must be greater than 0",
    });
  }

  // 3 & 4. Minimal 1 gambar & 1 primary (EC-PM-B3)
  //    Tanpa gambar sama sekali → dua-duanya gagal.
  //    Gambar ada tapi tanpa primary (edge) → hanya primary.
  if (snapshot.images.length === 0) {
    failures.push({
      code: "PRODUCT_NEEDS_IMAGE",
      message: "Product must have at least 1 image",
    });
    failures.push({
      code: "PRODUCT_NEEDS_PRIMARY_IMAGE",
      message: "Product must have a primary image",
    });
  } else if (!snapshot.images.some((i) => i.isPrimary)) {
    failures.push({
      code: "PRODUCT_NEEDS_PRIMARY_IMAGE",
      message: "Product must have a primary image",
    });
  }

  // 5. Kategori terisi (BR-24)
  if (snapshot.categoryId === null) {
    failures.push({
      code: "CATEGORY_REQUIRED",
      message: "Category is required before publishing",
    });
  }

  return failures;
}

async function assertPublishableAndGetSnapshot(
  id: string,
  fromStatus: PublishEntryStatus,
): Promise<PublishSnapshot> {
  const snapshot = await readPublishSnapshot(id);
  if (!snapshot) throw ProductErrors.productNotFound();

  // Keputusan #1: publish dari DRAFT, republish dari INACTIVE.
  // Status lain (sudah ACTIVE, atau mismatch) → INVALID_STATUS_TRANSITION.
  if (snapshot.status !== fromStatus) {
    throw ProductErrors.invalidStatusTransition(snapshot.status, "ACTIVE");
  }

  const failures = collectPublishFailures(snapshot);
  if (failures.length > 0) {
    throw ProductErrors.publishValidationFailed(failures);
  }

  return snapshot;
}

/**
 * Disambiguasi setelah `$executeRaw` mengembalikan affected=0.
 *
 * Tiga kemungkinan penyebab WHERE tidak match:
 *  1. Produk tidak ada / soft-deleted → PRODUCT_NOT_FOUND.
 *  2. Status berubah (mis. publish concurrent) → INVALID_STATUS_TRANSITION.
 *  3. Syarat BR-07 baru gagal (mis. varian dihapus di tengah) → multi-error.
 *
 * Re-read snapshot untuk menghasilkan error yang akurat terhadap
 * state SEKARANG, bukan snapshot basi saat read awal.
 *
 * Return type `Promise<never>` karena fungsi ini SELALU throw —
 * memudahkan caller cukup `return disambiguateTransitionFailure(...)`.
 */
async function disambiguateTransitionFailure(
  id: string,
  fromStatus: PublishEntryStatus,
): Promise<never> {
  const current = await readPublishSnapshot(id);
  if (!current) throw ProductErrors.productNotFound();
  if (current.status !== fromStatus) {
    throw ProductErrors.invalidStatusTransition(current.status, "ACTIVE");
  }
  const currentFailures = collectPublishFailures(current);
  if (currentFailures.length > 0) {
    throw ProductErrors.publishValidationFailed(currentFailures);
  }

  // Defensive — tidak reachable secara logika. Artinya siklus
  // DRAFT→X→DRAFT sangat sempit (atau bug di WHERE). Fail-closed,
  // jangan return sukses palsu.
  throw new AppError(
    "Status transition race detected; please retry",
    500,
    "INTERNAL_ERROR",
  );
}

/**
 * Deteksi Prisma unique violation (P2002). Defensive type guard.
 */
function isPrismaUniqueViolation(
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/**
 * Map Prisma `P2002` ke error code spesifik sesuai constraint yang
 * dilanggar.
 *
 * Dua unique constraint di tabel ProductVariant:
 *
 *  1. `ProductVariant_sku_key`
 *     - UNIQUE (sku), TANPA partial filter
 *     - Meliputi varian soft-deleted (BR-12, EC-PM-C13)
 *     - Pelanggaran → SKU_DUPLICATE (409)
 *
 *  2. `ProductVariant_product_size_color_active_key`
 *     - UNIQUE (product_id, COALESCE(size,''), COALESCE(color,''))
 *       WHERE deleted_at IS NULL
 *     - Hanya varian AKTIF (DD-PM-08)
 *     - Pelanggaran → VARIANT_DUPLICATE (409)
 *
 * Format meta P2002 berbeda antar versi Prisma:
 *  - Versi lama: meta.target = string[] (nama kolom)
 *  - Versi baru (Postgres): meta.constraint = nama constraint/index
 *
 * Cek keduanya (defensive) — jangan andalkan satu format.
 *
 * Fallback: kalau tidak match pola apa pun (bisa jadi ada unique
 * constraint baru di masa depan), default ke VARIANT_DUPLICATE
 * (lebih baik 409 yang generik daripada 500 yang menakutkan user).
 */
async function mapVariantUniqueViolation(
  err: Prisma.PrismaClientKnownRequestError,
  input: { sku?: string; size?: string | null; color?: string | null },
  excludeId?: string,
): Promise<AppError> {
  const haystack = [
    err.message ?? "",
    typeof err.meta?.target === "string" ? err.meta.target : "",
    Array.isArray(err.meta?.target)
      ? err.meta.target.map(String).join(" ")
      : "",
    typeof err.meta?.constraint === "string" ? err.meta.constraint : "",
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("sku")) return ProductErrors.skuDuplicate();
  if (haystack.includes("size") || haystack.includes("color")) {
    return ProductErrors.variantDuplicate();
  }

  // Fallback — hanya cek SKU kalau input.sku adalah string (create:
  // selalu; update: hanya kalau user mengirim field sku).
  if (typeof input.sku === "string") {
    const found = await prisma.productVariant.findUnique({
      where: { sku: input.sku },
      select: { id: true },
    });
    // Self-exclusion: kalau yang ditemukan row kita sendiri, bukan
    // konflik SKU — kemungkinan P2002 dipicu oleh constraint lain.
    if (found && found.id !== excludeId) return ProductErrors.skuDuplicate();
  }

  return ProductErrors.variantDuplicate();
}

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

export async function getProductDetailService(
  id: string,
  query: GetProductQuery,
): Promise<ProductDetailResponse> {
  const product = await prisma.product.findFirst({
    where: {
      id,
      // Filter di level DB: kalau include_deleted=false, produk
      // soft-deleted diperlakukan seolah tidak ada → 404.
      ...(query.include_deleted ? {} : { deletedAt: null }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdBy: true,
      updatedBy: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },

      variants: {
        // include_deleted=false → hanya varian aktif (BR-14).
        // include_deleted=true  → semua varian (audit).
        where: query.include_deleted ? {} : { deletedAt: null },
        // Urutan deterministik: paling lama dulu. Client yang butuh
        // sort lain (size/color) tinggal sort di UI — API tidak
        // memaksakan business ordering.
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          price: true, // Prisma.Decimal — mapper yang konversi
          stock: true,
          deletedAt: true, // dibutuhkan mapper untuk `deleted_at`
        },
      },

      images: {
        // Gambar tidak punya soft-delete (DD-PM-12) — selalu tampil
        // semua. Tidak ada filter `deletedAt`.
        orderBy: [
          { isPrimary: "desc" }, // primary di depan
          { sortOrder: "asc" }, // lalu sesuai urutan tampil
          { createdAt: "asc" }, // tiebreaker deterministik
        ],
        select: {
          id: true,
          url: true,
          isPrimary: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!product) throw ProductErrors.productNotFound();

  return toProductDetailResponse(product);
}

export async function updateProductService(
  id: string,
  input: UpdateProductInput,
  adminId: string,
): Promise<UpdateProductResponse> {
  const { name, description, category_id } = input;

  // Defense-in-depth: schema .refine() sudah menolak body kosong.
  if (
    name === undefined &&
    description === undefined &&
    category_id === undefined
  ) {
    throw new AppError(
      "At least one field must be provided for update",
      400,
      "VALIDATION_ERROR",
    );
  }

  // Pre-check kategori — HANYA untuk set kategori ke UUID baru.
  // Memberi feedback cepat untuk kasus umum; race tetap di-handle
  // lewat P2003 di catch (tidak ada state invalid yang lolos).
  if (typeof category_id === "string") {
    const exists = await prisma.category.findUnique({
      where: { id: category_id },
      select: { id: true },
    });
    if (!exists) throw ProductErrors.categoryNotFound();
  }

  // Partial update: hanya field yang dikirim. updatedBy selalu dari session.
  const data: Prisma.ProductUncheckedUpdateInput = { updatedBy: adminId };
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description || null; // "" -> null
  if (category_id !== undefined) data.categoryId = category_id;

  // where dasar: extended where { id, deletedAt: null } → soft-delete-safe (BR-05).
  const where: Prisma.ProductWhereUniqueInput = { id, deletedAt: null };

  // ── Race guard: clear kategori (null) TIDAK boleh pada produk ACTIVE
  //    (BR-07, BR-24).
  //
  // Sebelumnya: findFirst cek status lalu update — ada window di mana
  // publish concurrent bisa mengubah status jadi ACTIVE di antara
  // findFirst dan update, membuat produk ACTIVE tanpa kategori.
  //
  // Fix: dorong syarat `status != ACTIVE` ke WHERE update → ATOMIK.
  // Kalau tidak match, Prisma lempar P2025; disambiguate di catch.
  if (category_id === null) {
    where.status = { not: "ACTIVE" };
  }

  try {
    // Satu query atomik. deletedAt: null + (kondisional) status != ACTIVE
    // diterapkan bersamaan dengan UPDATE — tidak ada celah race.
    const row = await prisma.product.update({
      where,
      data,
      select: {
        id: true,
        name: true,
        description: true,
        categoryId: true,
        status: true,
        updatedBy: true,
        updatedAt: true,
      },
    });
    return toUpdateProductResponse(row);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;

    // P2025 = record to update not found. Bisa karena:
    //   1. id tidak ada
    //   2. deletedAt != null (soft-deleted)
    //   3. status === ACTIVE (hanya saat kita menambah filter status)
    if (code === "P2025") {
      if (category_id === null) {
        // Disambiguate: butuh bedakan "produk tidak ada" vs "produk ACTIVE".
        const existing = await prisma.product.findFirst({
          where: { id, deletedAt: null },
          select: { status: true },
        });
        if (!existing) throw ProductErrors.productNotFound();
        // Baris ada & tidak soft-deleted → satu-satunya alasan P2025
        // adalah filter `status != ACTIVE` → produk ACTIVE saat update.
        throw ProductErrors.categoryRequired();
      }
      // Tanpa filter status, P2025 = id tidak ada / soft-deleted.
      throw ProductErrors.productNotFound();
    }

    // P2003 = foreign key violated. Kalau baru set category_id ke UUID,
    // kemungkinan besar kategori sudah dihapus setelah pre-check (race).
    // Re-check untuk konfirmasi — jangan andalkan format meta Prisma
    // (bisa berubah antar versi).
    if (code === "P2003" && typeof category_id === "string") {
      const stillExists = await prisma.category.findUnique({
        where: { id: category_id },
        select: { id: true },
      });
      if (!stillExists) throw ProductErrors.categoryNotFound();
    }

    throw err;
  }
}

export async function softDeleteProductService(
  id: string,
  adminId: string,
): Promise<void> {
  // ── Single atomic statement. Catatan tipe casting:
  //    - `id` / `updated_by`: kolom TEXT di Postgres (Prisma String).
  //    - `status`: enum "ProductStatus", butuh cast eksplisit saat
  //      membandingkan dengan string literal.
  //    - `NOW()`: clock Postgres, konsisten dengan @default(now()).
  //    - `updated_at`: TIDAK di-trigger otomatis oleh @updatedAt
  //      decorator saat raw SQL, jadi diset manual di sini.
  //    - Tagged template (`prisma.$executeRaw` + backtick) otomatis
  //      parameterizes semua interpolasi → tidak ada celah SQL injection.
  const affected = await prisma.$executeRaw`
    UPDATE "Product"
    SET
      "deleted_at"  = NOW(),
      "updated_at"  = NOW(),
      "updated_by"  = ${adminId},
      "status"      = CASE
        WHEN "status" = 'ACTIVE'::"ProductStatus"
          THEN 'INACTIVE'::"ProductStatus"
        ELSE "status"
      END
    WHERE "id" = ${id}
      AND "deleted_at" IS NULL
  `;

  // affected = 0 → tidak ada baris yang match. Dua kemungkinan,
  // sengaja digabung menjadi 404 yang sama (anti-enumeration):
  //   1. id tidak ada sama sekali
  //   2. id ada tapi sudah soft-deleted (double-delete)
  if (affected === 0) throw ProductErrors.productNotFound();
}

export async function publishProductService(
  id: string,
  adminId: string,
): Promise<PublishProductResponse> {
  // ── 1. Read snapshot (advisory) ──────────────────────────────
  const snapshot = await readPublishSnapshot(id);
  if (!snapshot) throw ProductErrors.productNotFound();

  // Keputusan #1: publish HANYA dari DRAFT. INACTIVE → /republish.
  if (snapshot.status !== "DRAFT") {
    throw ProductErrors.invalidStatusTransition(snapshot.status, "ACTIVE");
  }

  const initialFailures = collectPublishFailures(snapshot);
  if (initialFailures.length > 0) {
    throw ProductErrors.publishValidationFailed(initialFailures);
  }

  // ── 2. Transisi atomik — SEMUA syarat BR-07 di WHERE ────────
  //    `updated_at` diset manual karena `@updatedAt` Prisma
  //    decorator tidak trigger di raw SQL (itu fitur PrismaClient,
  //    bukan trigger Postgres).
  const affected = await prisma.$executeRaw`
    UPDATE "Product"
    SET
      "status"     = 'ACTIVE'::"ProductStatus",
      "updated_at" = NOW(),
      "updated_by" = ${adminId}
    WHERE "id" = ${id}
      AND "status" = 'DRAFT'::"ProductStatus"
      AND "deleted_at" IS NULL
      AND "category_id" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "ProductVariant"
        WHERE "product_id" = ${id}
          AND "deleted_at" IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM "ProductVariant"
        WHERE "product_id" = ${id}
          AND "deleted_at" IS NULL
          AND "price" <= 0
      )
      AND EXISTS (
        SELECT 1 FROM "ProductImage"
        WHERE "product_id" = ${id}
          AND "is_primary" = true
      )
  `;

  // ── 3. Disambiguasi — state berubah antara read & update ────
  //    Re-read dan re-validate: user melihat error yang
  //    mencerminkan state SEKARANG, bukan snapshot basi.
  if (affected === 0) {
    const current = await readPublishSnapshot(id);
    if (!current) throw ProductErrors.productNotFound();
    if (current.status !== "DRAFT") {
      throw ProductErrors.invalidStatusTransition(current.status, "ACTIVE");
    }
    const currentFailures = collectPublishFailures(current);
    if (currentFailures.length > 0) {
      throw ProductErrors.publishValidationFailed(currentFailures);
    }
    // Fallback defensif — TIDAK reachable secara logika. Artinya
    // race DRAFT→X→DRAFT yang sangat sempit atau bug di WHERE.
    // Lebih baik fail eksplisit daripada silently return sukses
    // palsu. Client boleh retry.
    throw new AppError(
      "Publish race detected; please retry",
      500,
      "INTERNAL_ERROR",
    );
  }

  return { id, status: "ACTIVE" };
}

export async function republishProductService(
  id: string,
  adminId: string,
): Promise<RepublishProductResponse> {
  // Read + validasi BR-07 + status guard "harus INACTIVE".
  await assertPublishableAndGetSnapshot(id, "INACTIVE");

  // Transisi atomik — IDENTIK dengan publish kecuali literal
  // 'INACTIVE' di WHERE status. Literal (bukan parameter)
  // supaya SQL-nya compile-time constant, gampang di-grep, dan
  // unit test bisa assert exact string.
  const affected = await prisma.$executeRaw`
    UPDATE "Product"
    SET
      "status"     = 'ACTIVE'::"ProductStatus",
      "updated_at" = NOW(),
      "updated_by" = ${adminId}
    WHERE "id" = ${id}
      AND "status" = 'INACTIVE'::"ProductStatus"
      AND "deleted_at" IS NULL
      AND "category_id" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "ProductVariant"
        WHERE "product_id" = ${id}
          AND "deleted_at" IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM "ProductVariant"
        WHERE "product_id" = ${id}
          AND "deleted_at" IS NULL
          AND "price" <= 0
      )
      AND EXISTS (
        SELECT 1 FROM "ProductImage"
        WHERE "product_id" = ${id}
          AND "is_primary" = true
      )
  `;

  if (affected === 0) {
    return disambiguateTransitionFailure(id, "INACTIVE");
  }

  return { id, status: "ACTIVE" };
}

export async function unpublishProductService(
  id: string,
  adminId: string,
): Promise<UnpublishProductResponse> {
  // ── Transisi atomik ──────────────────────────────────────────
  // WHERE `status: "ACTIVE"` menjamin:
  //  - Tidak overwrite status yang sudah berubah (unpublish
  //    concurrent / publish concurrent).
  // WHERE `deletedAt: null` menjamin:
  //  - Tidak menyentuh produk yang baru saja di-soft-delete
  //    (BR-05 race-safe).
  // `updatedBy` di-set agar audit trail mencerminkan actor terakhir.
  const result = await prisma.product.updateMany({
    where: { id, status: "ACTIVE", deletedAt: null },
    data: { status: "INACTIVE", updatedBy: adminId },
  });

  // ── count=0 → disambiguasi ───────────────────────────────────
  // Tiga kemungkinan:
  //  1. Produk tidak ada (id tidak match).
  //  2. Produk soft-deleted (deletedAt != null).
  //  3. Status bukan ACTIVE (DRAFT / INACTIVE / berubah concurrent).
  //
  // Re-read untuk membedakan not-found vs status-transition.
  // Not-found & soft-deleted digabung → PRODUCT_NOT_FOUND (anti-
  // enumeration).
  if (result.count === 0) {
    const current = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { status: true },
    });
    if (!current) throw ProductErrors.productNotFound();
    throw ProductErrors.invalidStatusTransition(current.status, "INACTIVE");
  }

  return { id, status: "INACTIVE" };
}

export async function createVariantService(
  productId: string,
  input: CreateVariantBodyInput,
  adminId: string,
): Promise<CreateVariantResponse> {
  // ── 1. Business rules (fast fail, tanpa sentuh DB) ──────────────
  //
  // Sengaja di sini (bukan Zod) supaya error code spesifik per PRD:
  // ATTRIBUTE_REQUIRED / INVALID_PRICE / INVALID_STOCK — bukan
  // VALIDATION_ERROR generik.

  if (input.size === null && input.color === null) {
    throw ProductErrors.attributeRequired();
  }

  if (input.price <= 0) {
    throw ProductErrors.invalidPrice(input.price);
  }

  if (input.stock < 0) {
    throw ProductErrors.invalidStock(input.stock);
  }

  // ── 2. Transaction: lock product + insert ──────────────────────
  try {
    const row = await prisma.$transaction(async (tx) => {
      // Lock product row (FOR UPDATE) — block concurrent soft-delete
      // sampai transaksi ini commit. Filter `deleted_at IS NULL`:
      //  - Product tidak ada  → 0 rows
      //  - Product soft-deleted → 0 rows (tidak lock, tidak insert)
      //  - Product valid → 1 row, row-locked
      //
      // Parameterization: `productId` di-parameterize Prisma (tagged
      // template) — bukan interpolasi string, tidak ada SQL injection.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE id = ${productId} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (locked.length === 0) throw ProductErrors.productNotFound();

      return tx.productVariant.create({
        data: {
          productId,
          sku: input.sku,
          size: input.size,
          color: input.color,
          price: input.price,
          stock: input.stock,
          createdBy: adminId,
          updatedBy: adminId,
        },
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          price: true,
          stock: true,
        },
      });
    });

    return toCreateVariantResponse(row);
  } catch (err) {
    // P2002 = unique violation. Bisa dari:
    //  - `ProductVariant_sku_key` → SKU_DUPLICATE
    //  - `ProductVariant_product_size_color_active_key` → VARIANT_DUPLICATE
    if (isPrismaUniqueViolation(err)) {
      throw await mapVariantUniqueViolation(err, input);
    }
    throw err;
  }
}

export async function listVariantService(
  productId: string,
  query: ListVariantsQuery,
): Promise<ListVariantsResponse> {
  // ── Susun filter variants ────────────────────────────────────
  // Prisma otomatis menambahkan FK filter (`productId = ...`) saat
  // nested select pada relasi — jadi kita hanya menambahkan filter
  // turunan (deletedAt, stock).
  //
  // Filter composition:
  //  - default            → { deletedAt: null }
  //  - include_deleted    → {} (semua varian)
  //  - low_stock          → { stock: { lt: THRESHOLD } }
  //  - kombinasi keduanya → { stock: { lt: THRESHOLD } }
  //    (deletedAt tidak difilter → termasuk yang soft-deleted)
  const variantWhere: Prisma.ProductVariantWhereInput = {};

  if (!query.include_deleted) {
    variantWhere.deletedAt = null;
  }

  if (query.low_stock) {
    variantWhere.stock = { lt: LOW_STOCK_THRESHOLD };
  }

  // ── Single nested query ──────────────────────────────────────
  // `findFirst` (bukan `findUnique`) karena butuh filter
  // `deletedAt: null` — bukan unique constraint, jadi Prisma
  // `findUnique` extended where tidak portable di semua versi.
  //
  // Kalau product tidak ada / soft-deleted → parent query return
  // null → 404. Kalau ada tapi varian kosong → return
  // `{ variants: [] }` → 200 dengan `items: []`.
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      // BR-05: soft-deleted product diperlakukan seolah tidak ada
      // (404), konsisten dengan endpoint detail.
      deletedAt: null,
    },
    select: {
      variants: {
        where: variantWhere,
        // Order deterministik:
        //  - `createdAt: asc` → varian terlama tampil dulu
        //    (konsisten dengan nested variants di endpoint detail).
        //  - `id: asc` sebagai TIEBREAKER — dua varian bisa punya
        //    `createdAt` identik (bulk insert dalam satu transaksi),
        //    dan Postgres tidak menjamin urutan stabil tanpa
        //    tiebreaker. `id` UUID adalah PK unique → urutan
        //    konsisten antar request.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        // Select hanya field yang dibutuhkan DTO + mapper. Field
        // sensitif internal (createdBy, updatedBy) sengaja tidak
        // di-select → tidak bisa bocor ke response.
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          price: true, // Prisma Decimal — dikonversi di mapper
          stock: true,
          deletedAt: true, // dibutuhkan mapper untuk `deleted_at`
        },
      },
    },
  });

  // Product tidak ada atau soft-deleted → 404. Keduanya digabung
  // (anti-enumeration) — tidak bisa dibedakan dari luar.
  if (!product) throw ProductErrors.productNotFound();

  // ── Map ke DTO ────────────────────────────────────────────────
  // Reuse `toVariantDetail` dari DTO detail produk — shape item
  // identik (PRD FR-PM-03 & FR-PM-12). Satu mapper, satu tempat
  // konversi Decimal → number & Date → ISO.
  //
  // `product.variants` dijamin array (bisa kosong), bukan undefined
  // — Prisma mengembalikan `[]` untuk relasi list tanpa rows.
  const items: VariantListItem[] = product.variants.map(toVariantDetail);

  return { items };
}

export async function updateVariantService(
  productId: string,
  variantId: string,
  input: UpdateVariantBodyInput,
  adminId: string,
): Promise<UpdateVariantResponse> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      // ── 1. Lock product (parent) ────────────────────────────
      // Product soft-deleted concurrent → block. Kalau produk
      // hilang / soft-deleted sebelum lock → 0 rows → 404.
      const products = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Product"
        WHERE id = ${productId} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (products.length === 0) throw ProductErrors.productNotFound();

      // ── 2. Lock & fetch variant (child) ─────────────────────
      // IDOR guard: `product_id = productId` → variant milik
      // product lain tidak ter-select.
      // Soft-delete-safe: `deleted_at IS NULL` → variant yang baru
      // di-soft-delete tidak ter-select.
      const variants = await tx.$queryRaw<
        Array<{
          id: string;
          sku: string;
          size: string | null;
          color: string | null;
          price: unknown; // Prisma Decimal | string — konversi via Number()
          stock: number;
        }>
      >`
        SELECT id, sku, size, color, price, stock
        FROM "ProductVariant"
        WHERE id = ${variantId}
          AND product_id = ${productId}
          AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (variants.length === 0) throw ProductErrors.variantNotFound();

      const current = variants[0];

      // ── 3. Merge validation (BR-11, BR-15, BR-21) ───────────
      // Field yang tidak dikirim (undefined) memakai existing.
      // Field yang dikirim null (explicit clear) tetap null.
      // Field yang dikirim string memakai string.
      const mergedSize = input.size !== undefined ? input.size : current.size;
      const mergedColor =
        input.color !== undefined ? input.color : current.color;
      if (mergedSize === null && mergedColor === null) {
        throw ProductErrors.attributeRequired();
      }

      const mergedPrice =
        input.price !== undefined ? input.price : Number(current.price);
      if (mergedPrice <= 0) throw ProductErrors.invalidPrice(mergedPrice);

      const mergedStock =
        input.stock !== undefined ? input.stock : current.stock;
      if (mergedStock < 0) throw ProductErrors.invalidStock(mergedStock);

      // ── 4. Build data (whitelist eksplisit) ─────────────────
      // Defense-in-depth setelah Zod `.strict()`: hanya field
      // yang diizinkan yang masuk ke `data`, meski (secara bug)
      // ada field lain di `input`.
      const data: Prisma.ProductVariantUncheckedUpdateInput = {
        updatedBy: adminId,
      };
      if (input.sku !== undefined) data.sku = input.sku;
      if (input.size !== undefined) data.size = input.size;
      if (input.color !== undefined) data.color = input.color;
      if (input.price !== undefined) data.price = input.price;
      if (input.stock !== undefined) data.stock = input.stock;

      // ── 5. UPDATE (WHERE id saja — product & deleted_at sudah
      //    dijaga oleh FOR UPDATE sebelumnya) ────────────────
      return tx.productVariant.update({
        where: { id: variantId },
        data,
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          price: true,
          stock: true,
        },
      });
    });

    return toCreateVariantResponse(row);
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      // Pass `variantId` sebagai excludeId — mencegah false
      // SKU_DUPLICATE saat input.sku = current sku (fallback
      // findUnique akan menemukan row kita sendiri → di-skip).
      throw await mapVariantUniqueViolation(
        err,
        {
          sku: input.sku,
          size: input.size,
          color: input.color,
        },
        variantId,
      );
    }
    throw err;
  }
}

export async function softDeleteVariantService(
  productId: string,
  variantId: string,
  adminId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // ── 1. Lock product (parent) ─────────────────────────────
    // `status` di-select karena dibutuhkan untuk BR-27 (branch
    // ACTIVE vs lainnya). Lock mencegah product soft-deleted
    // concurrent & serialize concurrent delete varian lain dari
    // produk yang sama.
    const products = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM "Product"
      WHERE id = ${productId} AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (products.length === 0) throw ProductErrors.productNotFound();
    const productStatus = products[0].status;

    // ── 2. Lock variant (child) ──────────────────────────────
    // IDOR: `product_id = productId` — variant milik produk lain
    // tidak ter-select.
    // Race guard: `deleted_at IS NULL` — double-delete concurrent
    // → yang kalah tidak match → 404.
    const variants = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "ProductVariant"
      WHERE id = ${variantId}
        AND product_id = ${productId}
        AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (variants.length === 0) throw ProductErrors.variantNotFound();

    // ── 3. Soft delete variant (BR-14) ───────────────────────
    // `@updatedAt` di schema Prisma otomatis meng-update
    // `updatedAt` — tidak perlu set manual.
    await tx.productVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date(), updatedBy: adminId },
    });

    // ── 4. Count remaining active variants ───────────────────
    // `deletedAt: null` otomatis exclude variant yang baru
    // di-soft-delete di langkah 3.
    const remaining = await tx.productVariant.count({
      where: { productId, deletedAt: null },
    });

    // ── 5. BR-27: varian terakhir di-soft-delete + produk ACTIVE
    //    → INACTIVE. Status lain (DRAFT, INACTIVE) dibiarkan.
    //
    // Cek `productStatus === "ACTIVE"` (dari SELECT FOR UPDATE
    // di langkah 1) — bukan re-query, karena lock product sudah
    // dipegang dari awal transaksi, status tidak bisa berubah
    // sampai transaksi commit.
    if (remaining === 0 && productStatus === "ACTIVE") {
      await tx.product.update({
        where: { id: productId },
        data: { status: "INACTIVE", updatedBy: adminId },
      });
    }
  });
}

export async function updateStockService(
  productId: string,
  variantId: string,
  stock: number,
  adminId: string,
): Promise<UpdateStockResponse> {
  // ── 1. Business rule (BR-21) ────────────────────────────────
  // Zod sudah pastikan `stock` integer & finite. Di sini kita
  // validasi `stock >= 0` → code spesifik INVALID_STOCK (bukan
  // VALIDATION_ERROR generik dari Zod).
  if (stock < 0) throw ProductErrors.invalidStock(stock);

  // ── 2. Atomic UPDATE dengan semua guard di WHERE ────────────
  // Semua kondisi dievaluasi Postgres dalam 1 statement dengan
  // row lock yang tepat. Tidak ada window check-then-act.
  const affected = await prisma.$executeRaw`
    UPDATE "ProductVariant"
    SET
      "stock"      = ${stock},
      "updated_at" = NOW(),
      "updated_by" = ${adminId}
    WHERE "id" = ${variantId}
      AND "product_id" = ${productId}
      AND "deleted_at" IS NULL
      AND EXISTS (
        SELECT 1 FROM "Product"
        WHERE "id" = ${productId}
          AND "deleted_at" IS NULL
      )
  `;

  // ── 3. Disambiguasi 404 ─────────────────────────────────────
  // affected=0 menggabungkan 4 kondisi:
  //   a. Variant tidak ada (id tidak match)
  //   b. Variant soft-deleted (deleted_at != null)
  //   c. Variant milik product lain (product_id mismatch — IDOR)
  //   d. Product soft-deleted / tidak ada
  //
  // Disambiguasi:
  //   - Product ada & aktif? → a/b/c → VARIANT_NOT_FOUND
  //   - Product tidak ada / soft-deleted → PRODUCT_NOT_FOUND
  //
  // Kedua 404 tidak membedakan "tidak ada" vs "sudah dihapus" —
  // anti-enumeration. Konsisten dengan endpoint lain.
  if (affected === 0) {
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw ProductErrors.productNotFound();
    throw ProductErrors.variantNotFound();
  }

  // ── 4. Return dari input (bukan re-fetch) ───────────────────
  // `$executeRaw` mengembalikan affected count, bukan row. Kita
  // tahu persis nilai yang baru di-set (`stock`) — konstruksi
  // response langsung dari input.
  //
  // Minor staleness risk: concurrent update stock setelah kita
  // (sebelum response sampai client) — state akhir adalah yang
  // terakhir commit (Last Write Wins). Client yang butuh current
  // state bisa GET /variants.
  return toUpdateStockResponse(variantId, stock);
}

export async function listLowStockVariantsService(): Promise<LowStockListResponse> {
  // Single query dengan relasi product — no N+1.
  // Filter `stock < threshold` didorong ke DB (pakai index `stock`).
  const rows = await prisma.productVariant.findMany({
    where: {
      stock: { lt: LOW_STOCK_THRESHOLD },
      deletedAt: null,
      product: { deletedAt: null },
    },
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      stock: true,
      // Nested select — field product minimal yang dibutuhkan DTO.
      product: { select: { id: true, name: true } },
    },
    // Order deterministik: paling kritis dulu, tiebreaker id.
    orderBy: [{ stock: "asc" }, { id: "asc" }],
  });

  return { items: rows.map(toLowStockVariantItem) };
}
