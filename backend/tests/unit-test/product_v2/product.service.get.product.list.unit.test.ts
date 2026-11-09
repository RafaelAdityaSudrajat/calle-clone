// src/modules/product/product.getListProductService.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../src/generated/prisma";

// Mock `prisma` — untuk .list() kita hanya butuh `$transaction`.
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../../../src/lib/prisma";
import { getListProductService } from "../../../src/modules/product_v2/product_v2.service";
import type { ListProductsQuery } from "../../../src/modules/product_v2/product_v2.schema";

const mockTransaction = vi.mocked(prisma.$transaction);

/**
 * Helper: query default tervalidasi. Setiap test tinggal override field
 * yang relevan. `include_deleted: false` karena itu default schema.
 */
function q(overrides: Partial<ListProductsQuery> = {}): ListProductsQuery {
  return {
    page: 1,
    limit: 10,
    search: undefined,
    status: undefined,
    category_id: undefined,
    include_deleted: false,
    ...overrides,
  };
}

/**
 * Setup fake `tx` dan wire `$transaction` supaya:
 *  - Callback service langsung dieksekusi dengan `tx`.
 *  - `mock.calls` tetap merekam `(callback, options)` — untuk assert
 *    isolation level.
 */
function mockTx() {
  const tx = {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    productVariant: {
      groupBy: vi.fn(),
    },
  };
  // Cast ke `any` — overload $transaction di Prisma sangat generik.
  mockTransaction.mockImplementation(((cb: any) => cb(tx)) as any);
  return tx;
}

describe("getListProductService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── Case 1: Happy path — items + pagination + stats varian ────
  it("mengembalikan items, pagination, dan stats varian dengan benar", async () => {
    const tx = mockTx();
    const d1 = new Date("2026-10-01T00:00:00.000Z");
    const d2 = new Date("2026-10-02T00:00:00.000Z");

    tx.product.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Kaos",
        status: "DRAFT",
        createdAt: d1,
        updatedAt: d1,
        category: { id: "c1", name: "Atasan" },
        images: [{ url: "u1" }],
      },
      {
        id: "p2",
        name: "Topi",
        status: "DRAFT",
        createdAt: d2,
        updatedAt: d2,
        category: null,
        images: [],
      },
    ] as any);
    tx.product.count.mockResolvedValue(2);
    tx.productVariant.groupBy.mockResolvedValue([
      { productId: "p1", _sum: { stock: 15 }, _count: { _all: 3 } },
    ] as any);

    const result = await getListProductService(q());

    const findCall = tx.product.findMany.mock.calls[0][0];

    // Pagination: skip=(1-1)*10=0, take=limit.
    expect(findCall.skip).toBe(0);
    expect(findCall.take).toBe(10);
    expect(findCall.orderBy).toEqual({ createdAt: "desc" });

    // Select subset — verifikasi tidak mengambil kolom berlebih.
    expect(findCall.select).toMatchObject({
      id: true,
      name: true,
      status: true,
      category: { select: { id: true, name: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    });

    // count memakai WHERE yang sama → konsisten untuk pagination.
    expect(tx.product.count.mock.calls[0][0].where).toEqual(findCall.where);

    // groupBy: filter varian aktif untuk halaman ini.
    expect(tx.productVariant.groupBy).toHaveBeenCalledWith({
      by: ["productId"],
      where: { productId: { in: ["p1", "p2"] }, deletedAt: null },
      _sum: { stock: true },
      _count: { _all: true },
    });

    // Items mapping.
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: "p1",
      name: "Kaos",
      category: { id: "c1", name: "Atasan" },
      primary_image_url: "u1",
      variant_count: 3,
      total_stock: 15,
      created_at: d1.toISOString(),
    });
    expect(result.items[1]).toMatchObject({
      id: "p2",
      category: null,
      primary_image_url: null,
      variant_count: 0, // no stats row for p2
      total_stock: 0,
    });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      total_pages: 1, // ceil(2/10)
    });
  });

  // ── Case 2: WHERE default — soft-deleted dikecualikan ────────
  it("default menyembunyikan soft-deleted (deletedAt: null)", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    await getListProductService(q());

    const where = tx.product.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ deletedAt: null });
  });

  // ── Case 3: include_deleted=true — filter deletedAt hilang ───
  it("include_deleted=true TIDAK menambahkan filter deletedAt", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    await getListProductService(q({ include_deleted: true }));

    const where = tx.product.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("deletedAt");
    expect(Object.keys(where)).toHaveLength(0);
  });

  // ── Case 4: Filter status ─────────────────────────────────────
  it("menambahkan filter status saat dikirim", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    await getListProductService(q({ status: "ACTIVE" }));

    const where = tx.product.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ deletedAt: null, status: "ACTIVE" });
  });

  // ── Case 5: Filter category ───────────────────────────────────
  it("menambahkan filter categoryId saat dikirim", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    await getListProductService(
      q({ category_id: "00000000-0000-0000-0000-0000000c0001" }),
    );

    const where = tx.product.findMany.mock.calls[0][0].where;
    expect(where.categoryId).toBe("00000000-0000-0000-0000-0000000c0001");
  });

  // ── Case 6: Search — nama OR sku varian aktif ────────────────
  it("search mencocokkan nama produk ATAU sku varian aktif (ILIKE)", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    await getListProductService(q({ search: "kaos" }));

    const where = tx.product.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { name: { contains: "kaos", mode: "insensitive" } },
      {
        variants: {
          some: {
            sku: { contains: "kaos", mode: "insensitive" },
            deletedAt: null, // hanya varian aktif
          },
        },
      },
    ]);
  });

  // ── Case 7: Kombinasi filter ─────────────────────────────────
  it("menggabungkan status + category + search + deletedAt dengan benar", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    await getListProductService(
      q({
        status: "DRAFT",
        category_id: "00000000-0000-0000-0000-0000000c0001",
        search: "topi",
      }),
    );

    const where = tx.product.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      deletedAt: null,
      status: "DRAFT",
      categoryId: "00000000-0000-0000-0000-0000000c0001",
    });
    expect(where.OR).toBeDefined();
  });

  // ── Case 8: Pagination math ──────────────────────────────────
  it("menghitung skip & total_pages dengan benar (page 3, limit 5, total 12)", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(12);

    const result = await getListProductService(q({ page: 3, limit: 5 }));

    expect(tx.product.findMany.mock.calls[0][0].skip).toBe(10); // (3-1)*5
    expect(tx.product.findMany.mock.calls[0][0].take).toBe(5);
    expect(result.pagination).toEqual({
      page: 3,
      limit: 5,
      total: 12,
      total_pages: 3, // ceil(12/5)
    });
  });

  // ── Case 9: total=0 → total_pages=0 ──────────────────────────
  it("total_pages=0 saat total=0 (honest output)", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    const result = await getListProductService(q());
    expect(result.pagination.total_pages).toBe(0);
  });

  //   ── Case 10: Halaman kosong → groupBy tidak dipanggil ────────
  it("tidak memanggil groupBy saat findMany mengembalikan 0 baris", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    await getListProductService(q());

    // Guard `productIds.length === 0` mencegah round-trip sia-sia.
    expect(tx.productVariant.groupBy).not.toHaveBeenCalled();
  });

  // ── Case 11: _sum.stock null → 0 ────────────────────────────
  it("menormalkan _sum.stock null menjadi 0", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Kaos",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: null,
        images: [],
      },
    ] as any);
    tx.product.count.mockResolvedValue(1);
    tx.productVariant.groupBy.mockResolvedValue([
      { productId: "p1", _sum: { stock: null }, _count: { _all: 0 } },
    ] as any);

    const result = await getListProductService(q());
    expect(result.items[0].total_stock).toBe(0);
    expect(result.items[0].variant_count).toBe(0);
  });

  // ── Case 12: Isolation level RepeatableRead ─────────────────
  it("memakai isolation level RepeatableRead untuk snapshot konsisten", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([]);
    tx.product.count.mockResolvedValue(0);

    await getListProductService(q());

    // Argumen kedua `$transaction` adalah { isolationLevel }.
    const [, opts] = mockTransaction.mock.calls[0];
    expect(opts).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  // ── Case 13: primary_image_url=null saat images kosong ──────
  it("primary_image_url=null saat produk tidak punya gambar primary", async () => {
    const tx = mockTx();
    tx.product.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Kaos",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: null,
        images: [],
      },
    ] as any);
    tx.product.count.mockResolvedValue(1);
    tx.productVariant.groupBy.mockResolvedValue([]);

    const result = await getListProductService(q());
    expect(result.items[0].primary_image_url).toBeNull();
  });

  // ── Case 14: Date → ISO string di created_at / updated_at ───
  it("mengonversi Date ke ISO-8601 string di created_at & updated_at", async () => {
    const tx = mockTx();
    const dt = new Date("2026-01-15T08:00:00.000Z");
    tx.product.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Kaos",
        status: "DRAFT",
        createdAt: dt,
        updatedAt: dt,
        category: null,
        images: [],
      },
    ] as any);
    tx.product.count.mockResolvedValue(1);
    tx.productVariant.groupBy.mockResolvedValue([]);

    const result = await getListProductService(q());
    expect(typeof result.items[0].created_at).toBe("string");
    expect(result.items[0].created_at).toBe("2026-01-15T08:00:00.000Z");
    expect(result.items[0].updated_at).toBe("2026-01-15T08:00:00.000Z");
  });
});
