import { Prisma } from "../../generated/prisma";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import {
  CreateProductResponse,
  ListProductsResponse,
  ProductDetailResponse,
  ProductVariantStats,
  PublishProductResponse,
  toCreateProductResponse,
  toProductDetailResponse,
  toProductListItem,
  toUpdateProductResponse,
  UpdateProductResponse,
} from "./product_v2.dto";
import { ProductErrors } from "./product_v2.errors";
import {
  CreateProductInput,
  GetProductQuery,
  ListProductsQuery,
  UpdateProductInput,
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
