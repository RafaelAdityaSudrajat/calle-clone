// tests/unit-test/product_v2/product.service.update-variant.unit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { updateVariantService } from "../../../src/modules/product_v2/product_v2.service";

// ── Mock Prisma client ──────────────────────────────────────────────
// Service memakai:
//  - `prisma.$transaction(cb)` → semua akses DB via `tx`
//  - `prisma.productVariant.findUnique` → fallback di
//    `mapVariantUniqueViolation` saat P2002 meta ambigu
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    productVariant: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../../../src/lib/prisma";
import { AppError } from "../../../src/lib/errors";

const mockTransaction = vi.mocked(prisma.$transaction);
const mockFindUnique = vi.mocked(prisma.productVariant.findUnique);

const ADMIN_ID = "00000000-0000-0000-0000-00000000ad01";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "33333333-3333-4333-8333-333333333333";

// ── Types & helpers ────────────────────────────────────────────────

interface VariantRow {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  price: string | number;
  stock: number;
}

/**
 * Setup fake `tx` + wire `$transaction` agar mengeksekusi callback.
 *
 * `$queryRaw` dipanggil 2x dalam transaksi:
 *  - Call 1: product lock → `[{ id: PRODUCT_ID }]`
 *  - Call 2: variant lock → `[current variant]`
 *
 * `productLocked` / `variantLocked` = array kosong untuk simulasikan
 * "0 rows" (produk / variant tidak ditemukan).
 */
function setupTx(
  opts: {
    productLocked?: Array<{ id: string }>;
    variantLocked?: VariantRow[];
  } = {},
) {
  const defaultVariant: VariantRow = {
    id: VARIANT_ID,
    sku: "KAOS-L",
    size: "L",
    color: "Hitam",
    price: "100000",
    stock: 10,
  };

  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce(opts.productLocked ?? [{ id: PRODUCT_ID }])
      .mockResolvedValueOnce(opts.variantLocked ?? [defaultVariant]),
    productVariant: { update: vi.fn() },
  };
  mockTransaction.mockImplementation(((cb: any) => cb(tx)) as any);
  return tx;
}

/** P2002 — unique constraint violation. */
function makeP2002(meta: Record<string, unknown> = {}, message?: string) {
  return new Prisma.PrismaClientKnownRequestError(
    message ?? "Unique constraint failed",
    { code: "P2002", clientVersion: "test", meta },
  );
}

/** Row hasil `tx.productVariant.update` pada happy path. */
function updatedRow(overrides: Partial<VariantRow> = {}) {
  return {
    id: VARIANT_ID,
    sku: "KAOS-L",
    size: "L",
    color: "Hitam",
    price: 100000,
    stock: 10,
    ...overrides,
  };
}

/** Normalisasi template literal SQL → single-line untuk assertion. */
function capturedSql(
  tx: ReturnType<typeof setupTx>,
  callIndex: number,
): string {
  const strings = tx.$queryRaw.mock.calls[
    callIndex
  ][0] as unknown as TemplateStringsArray;
  return strings.join("?").replace(/\s+/g, " ").trim();
}

// ── Test suite ─────────────────────────────────────────────────────

describe("updateVariantService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 1 — Happy paths (partial update)
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths — partial update", () => {
    it("update SKU saja — data hanya berisi sku + updatedBy", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(
        updatedRow({ sku: "KAOS-L-V2" }) as any,
      );

      const result = await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { sku: "KAOS-L-V2" },
        ADMIN_ID,
      );

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(tx.productVariant.update).toHaveBeenCalledWith({
        where: { id: VARIANT_ID },
        data: { updatedBy: ADMIN_ID, sku: "KAOS-L-V2" },
        select: expect.any(Object),
      });
      expect(result.sku).toBe("KAOS-L-V2");
      expect(result.low_stock).toBe(false);
    });

    it("update size saja (existing color null) — merged valid", async () => {
      const tx = setupTx({
        variantLocked: [
          {
            id: VARIANT_ID,
            sku: "KAOS-L",
            size: "L",
            color: null,
            price: "100000",
            stock: 10,
          },
        ],
      });
      tx.productVariant.update.mockResolvedValue(
        updatedRow({ size: "M", color: null }) as any,
      );

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { size: "M" },
        ADMIN_ID,
      );

      const data = tx.productVariant.update.mock.calls[0][0].data as any;
      expect(data).toEqual({ updatedBy: ADMIN_ID, size: "M" });
      expect(data).not.toHaveProperty("color");
    });

    it("update color saja (existing size valid) — merged valid", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(
        updatedRow({ color: "Merah" }) as any,
      );

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { color: "Merah" },
        ADMIN_ID,
      );

      const data = tx.productVariant.update.mock.calls[0][0].data as any;
      expect(data).toEqual({ updatedBy: ADMIN_ID, color: "Merah" });
    });

    it("clear size (existing color 'Hitam') — merged valid (BR-11)", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(
        updatedRow({ size: null }) as any,
      );

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { size: null },
        ADMIN_ID,
      );

      const data = tx.productVariant.update.mock.calls[0][0].data as any;
      expect(data.size).toBeNull();
    });

    it("clear color (existing size 'L') — merged valid (BR-11)", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(
        updatedRow({ color: null }) as any,
      );

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { color: null },
        ADMIN_ID,
      );

      const data = tx.productVariant.update.mock.calls[0][0].data as any;
      expect(data.color).toBeNull();
    });

    it("update price & stock bersama", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(
        updatedRow({ price: 150000, stock: 5 }) as any,
      );

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { price: 150000, stock: 5 },
        ADMIN_ID,
      );

      const data = tx.productVariant.update.mock.calls[0][0].data as any;
      expect(data).toEqual({
        updatedBy: ADMIN_ID,
        price: 150000,
        stock: 5,
      });
    });

    it("multi-field (sku + size + price) — semua masuk data", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(
        updatedRow({ sku: "NEW", size: "XL", price: 200000 }) as any,
      );

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { sku: "NEW", size: "XL", price: 200000 },
        ADMIN_ID,
      );

      const data = tx.productVariant.update.mock.calls[0][0].data as any;
      expect(data).toEqual({
        updatedBy: ADMIN_ID,
        sku: "NEW",
        size: "XL",
        price: 200000,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Merged state validation (BR-11, BR-15, BR-21)
  // ═══════════════════════════════════════════════════════════════
  describe("merged state validation", () => {
    it("clear size + existing color null → ATTRIBUTE_REQUIRED (BR-11)", async () => {
      const tx = setupTx({
        variantLocked: [
          {
            id: VARIANT_ID,
            sku: "KAOS-L",
            size: "L",
            color: null,
            price: "100000",
            stock: 10,
          },
        ],
      });

      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { size: null }, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "ATTRIBUTE_REQUIRED",
        statusCode: 400,
      });

      // Update tidak dipanggil.
      expect(tx.productVariant.update).not.toHaveBeenCalled();
    });

    it("clear size & color sekaligus (existing valid) → ATTRIBUTE_REQUIRED", async () => {
      const tx = setupTx();

      await expect(
        updateVariantService(
          PRODUCT_ID,
          VARIANT_ID,
          { size: null, color: null },
          ADMIN_ID,
        ),
      ).rejects.toMatchObject({
        code: "ATTRIBUTE_REQUIRED",
        statusCode: 400,
      });

      expect(tx.productVariant.update).not.toHaveBeenCalled();
    });

    it("merged price <= 0 → INVALID_PRICE (BR-15)", async () => {
      const tx = setupTx();

      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { price: 0 }, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "INVALID_PRICE",
        statusCode: 400,
      });

      expect(tx.productVariant.update).not.toHaveBeenCalled();
    });

    it("merged price negatif → INVALID_PRICE", async () => {
      const tx = setupTx();

      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { price: -100 }, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "INVALID_PRICE",
        statusCode: 400,
      });
    });

    it("merged stock negatif → INVALID_STOCK (BR-21)", async () => {
      const tx = setupTx();

      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { stock: -1 }, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "INVALID_STOCK",
        statusCode: 400,
      });

      expect(tx.productVariant.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Product / Variant not found (IDOR & soft-deleted)
  // ═══════════════════════════════════════════════════════════════
  describe("not found", () => {
    it("product lock kosong → PRODUCT_NOT_FOUND, variant lock tidak dipanggil", async () => {
      const tx = setupTx({ productLocked: [] });

      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { sku: "X" }, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "PRODUCT_NOT_FOUND",
        statusCode: 404,
      });

      // Hanya 1 $queryRaw (product lock), tidak ada variant lock.
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.productVariant.update).not.toHaveBeenCalled();
    });

    it("variant lock kosong → VARIANT_NOT_FOUND (mencakup IDOR & soft-deleted)", async () => {
      const tx = setupTx({ variantLocked: [] });

      // Empty result = variant tidak ada / soft-deleted / milik product lain.
      // WHERE `id = variantId AND product_id = productId AND deleted_at IS NULL`
      // tidak membedakan ketiganya → 404 yang sama (anti-enumeration).
      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { sku: "X" }, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "VARIANT_NOT_FOUND",
        statusCode: 404,
      });

      expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(tx.productVariant.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — P2002 mapping (SKU vs kombinasi, dengan self-exclusion)
  // ═══════════════════════════════════════════════════════════════
  describe("P2002 mapping (unique violation)", () => {
    it("P2002 dengan meta/constraint 'sku' → SKU_DUPLICATE (lapis 1, tanpa fallback)", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockRejectedValue(
        makeP2002(
          { constraint: "ProductVariant_sku_key" },
          "Unique constraint failed on the fields: (`sku`)",
        ),
      );

      await expect(
        updateVariantService(
          PRODUCT_ID,
          VARIANT_ID,
          { sku: "NEW-SKU" },
          ADMIN_ID,
        ),
      ).rejects.toMatchObject({
        code: "SKU_DUPLICATE",
        statusCode: 409,
      });

      // Lapis 1 match → tidak ada fallback query.
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("P2002 dengan meta/constraint 'size'/'color' → VARIANT_DUPLICATE (lapis 1)", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockRejectedValue(
        makeP2002(
          { constraint: "ProductVariant_product_size_color_active_key" },
          "Unique constraint failed on the fields: (`product_id`,`size`,`color`)",
        ),
      );

      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { size: "M" }, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "VARIANT_DUPLICATE",
        statusCode: 409,
      });

      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("P2002 ambigu (meta & message tanpa clue) → fallback: SKU dipakai row LAIN → SKU_DUPLICATE", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockRejectedValue(
        makeP2002({ some_unknown: "x" }, "Unique constraint failed"),
      );
      // findUnique menemukan row lain (bukan self) → benar-benar SKU konflik.
      mockFindUnique.mockResolvedValue({ id: "OTHER-VARIANT-ID" } as any);

      await expect(
        updateVariantService(
          PRODUCT_ID,
          VARIANT_ID,
          { sku: "SOME-SKU" },
          ADMIN_ID,
        ),
      ).rejects.toMatchObject({
        code: "SKU_DUPLICATE",
        statusCode: 409,
      });

      // Fallback dipanggil.
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { sku: "SOME-SKU" },
        select: { id: true },
      });
    });

    it("P2002 ambigu → fallback self-exclusion: SKU ditemukan = row SENDIRI → VARIANT_DUPLICATE", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockRejectedValue(
        makeP2002({ some_unknown: "x" }, "Unique constraint failed"),
      );
      // findUnique menemukan ROW KITA (id === variantId) →
      // berarti P2002 BUKAN dari SKU (kemungkinan dari kombinasi).
      mockFindUnique.mockResolvedValue({ id: VARIANT_ID } as any);

      await expect(
        updateVariantService(
          PRODUCT_ID,
          VARIANT_ID,
          { sku: "SAME-SKU" },
          ADMIN_ID,
        ),
      ).rejects.toMatchObject({
        code: "VARIANT_DUPLICATE",
        statusCode: 409,
      });

      // Fallback dipanggil, tapi self-exclusion → VARIANT_DUPLICATE.
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { sku: "SAME-SKU" },
        select: { id: true },
      });
    });

    it("P2002 ambigu + input tanpa sku → VARIANT_DUPLICATE tanpa fallback query", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockRejectedValue(
        makeP2002({ some_unknown: "x" }, "Unique constraint failed"),
      );

      // Input tidak punya `sku` → tidak ada fallback findUnique.
      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { size: "M" }, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "VARIANT_DUPLICATE",
        statusCode: 409,
      });

      expect(mockFindUnique).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Error passthrough
  // ═══════════════════════════════════════════════════════════════
  describe("error passthrough", () => {
    it("error non-P2002 → re-throw as-is", async () => {
      const tx = setupTx();
      const original = new Error("connection lost");
      tx.productVariant.update.mockRejectedValue(original);

      await expect(
        updateVariantService(PRODUCT_ID, VARIANT_ID, { sku: "X" }, ADMIN_ID),
      ).rejects.toBe(original);
    });

    it("business error (ATTRIBUTE_REQUIRED) adalah AppError instance", async () => {
      setupTx({
        variantLocked: [
          {
            id: VARIANT_ID,
            sku: "V",
            size: "L",
            color: null,
            price: "100000",
            stock: 10,
          },
        ],
      });

      try {
        await updateVariantService(
          PRODUCT_ID,
          VARIANT_ID,
          { size: null },
          ADMIN_ID,
        );
        expect.fail("harus throw");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Security & race guard
  // ═══════════════════════════════════════════════════════════════
  describe("security & race guard", () => {
    it("updatedBy diambil dari adminId — payload diabaikan (defense-in-depth)", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(updatedRow() as any);

      // Meskipun schema `.strict()` sudah tolak `updated_by` di body,
      // test ini verifikasi service juga tidak mempercayai input.
      const malicious = {
        sku: "X",
        updated_by: "attacker-id",
        created_by: "attacker-id",
      } as any;

      await updateVariantService(PRODUCT_ID, VARIANT_ID, malicious, ADMIN_ID);

      const data = tx.productVariant.update.mock.calls[0][0].data as any;
      expect(data.updatedBy).toBe(ADMIN_ID);
      expect(data.updatedBy).not.toBe("attacker-id");
      // Payload terlarang tidak masuk ke `data` (whitelist eksplisit).
      expect(data).not.toHaveProperty("created_by");
      expect(data).not.toHaveProperty("createdBy");
    });

    it("SQL product lock: FOR UPDATE + deleted_at IS NULL", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(updatedRow() as any);

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { sku: "X" },
        ADMIN_ID,
      );

      const productSql = capturedSql(tx, 0);
      expect(productSql).toContain('FROM "Product"');
      expect(productSql).toMatch(/FOR UPDATE/i);
      expect(productSql).toMatch(/deleted_at IS NULL/i);
      expect(productSql).toMatch(/id = \?/);
    });

    it("SQL variant lock: FOR UPDATE + deleted_at IS NULL + IDOR guard (product_id = ?)", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(updatedRow() as any);

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { sku: "X" },
        ADMIN_ID,
      );

      const variantSql = capturedSql(tx, 1);
      expect(variantSql).toContain('FROM "ProductVariant"');
      expect(variantSql).toMatch(/FOR UPDATE/i);
      expect(variantSql).toMatch(/deleted_at IS NULL/i);
      // IDOR guard — tanpa filter ini, variant milik product lain
      // bisa ter-update lewat cross-product request.
      expect(variantSql).toMatch(/product_id = \?/i);
      expect(variantSql).toMatch(/id = \?/i);
    });

    it("productId & variantId masuk sebagai binding (bukan interpolasi SQL string)", async () => {
      const tx = setupTx();
      tx.productVariant.update.mockResolvedValue(updatedRow() as any);

      await updateVariantService(
        PRODUCT_ID,
        VARIANT_ID,
        { sku: "X" },
        ADMIN_ID,
      );

      // Product lock: productId di-parameterize.
      const productValues = tx.$queryRaw.mock.calls[0].slice(1);
      expect(productValues).toContain(PRODUCT_ID);

      // Variant lock: productId & variantId di-parameterize.
      const variantValues = tx.$queryRaw.mock.calls[1].slice(1);
      expect(variantValues).toContain(VARIANT_ID);
      expect(variantValues).toContain(PRODUCT_ID);

      // Tidak ada ID yang masuk SQL string.
      const productSql = capturedSql(tx, 0);
      const variantSql = capturedSql(tx, 1);
      expect(productSql).not.toContain(PRODUCT_ID);
      expect(variantSql).not.toContain(VARIANT_ID);
      expect(variantSql).not.toContain(PRODUCT_ID);
    });
  });
});
