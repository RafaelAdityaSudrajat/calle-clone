// tests/unit-test/product_v2/product.service.create-variant.unit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { createVariantService } from "../../../src/modules/product_v2/product_v2.service";

// ── Mock Prisma client ──────────────────────────────────────────────
// Service memakai `prisma.$transaction` dengan callback yang menerima
// `tx` (Prisma.TransactionClient). Semua akses DB terjadi via `tx` —
// jadi cukup mock `$transaction` dan sediakan fake `tx`.
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../../../src/lib/prisma";
import { AppError } from "../../../src/lib/errors";

const mockTransaction = vi.mocked(prisma.$transaction);

const ADMIN_ID = "00000000-0000-0000-0000-00000000ad01";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

// ── Fake tx per test ────────────────────────────────────────────────
// Setiap test panggil `setupTx()` setelah `resetAllMocks` di beforeEach.
// Default: product dianggap ada (locked = [{ id: PRODUCT_ID }]).
function setupTx(overrides: { locked?: Array<{ id: string }> } = {}) {
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue(overrides.locked ?? [{ id: PRODUCT_ID }]),
    productVariant: { create: vi.fn() },
  };
  // Jalankan callback dengan fake tx. Callback async → return Promise;
  // rejection dari dalam callback dipropagasi seperti perilaku Prisma asli.
  mockTransaction.mockImplementation(((cb: any) => cb(tx)) as any);
  return tx;
}

// ── Builders ────────────────────────────────────────────────────────

/** P2002 — unique constraint violation. */
function makeP2002(
  meta: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta,
  });
}

/** Input dasar; tiap test override field yang relevan. */
function baseInput(
  overrides: Partial<{
    sku: string;
    size: string | null;
    color: string | null;
    price: number;
    stock: number;
  }> = {},
) {
  return {
    sku: "KAOS-L",
    size: "L",
    color: "Hitam",
    price: 100000,
    stock: 10,
    ...overrides,
  };
}

/** Row yang dikembalikan `tx.productVariant.create` pada happy path. */
function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-uuid",
    sku: "KAOS-L",
    size: "L",
    color: "Hitam",
    price: 100000,
    stock: 10,
    ...overrides,
  };
}

describe("createVariantService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 1 — Happy paths
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths", () => {
    it("sukses dengan size & color — DTO lengkap, transaction dipanggil sekali", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockResolvedValue(variantRow() as any);

      const result = await createVariantService(
        PRODUCT_ID,
        baseInput({ size: "L", color: "Hitam" }),
        ADMIN_ID,
      );

      // Transaction + lock + insert: 1x transaksi, 1x lock, 1x insert.
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.productVariant.create).toHaveBeenCalledTimes(1);

      // DTO: snake_case, price number, low_stock derived.
      expect(result).toEqual({
        id: "variant-uuid",
        sku: "KAOS-L",
        size: "L",
        color: "Hitam",
        price: 100000,
        stock: 10,
        low_stock: false, // 10 >= 5
      });
    });

    it("sukses dengan size saja (color null)", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockResolvedValue(
        variantRow({ size: "L", color: null }) as any,
      );

      const result = await createVariantService(
        PRODUCT_ID,
        baseInput({ size: "L", color: null }),
        ADMIN_ID,
      );

      expect(result.size).toBe("L");
      expect(result.color).toBeNull();
      expect(tx.productVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ size: "L", color: null }),
        }),
      );
    });

    it("sukses dengan color saja (size null)", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockResolvedValue(
        variantRow({ size: null, color: "Hitam" }) as any,
      );

      const result = await createVariantService(
        PRODUCT_ID,
        baseInput({ size: null, color: "Hitam" }),
        ADMIN_ID,
      );

      expect(result.size).toBeNull();
      expect(result.color).toBe("Hitam");
      expect(tx.productVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ size: null, color: "Hitam" }),
        }),
      );
    });

    it("low_stock=true saat stock < 5", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockResolvedValue(
        variantRow({ stock: 4 }) as any,
      );

      const result = await createVariantService(
        PRODUCT_ID,
        baseInput({ stock: 4 }),
        ADMIN_ID,
      );

      expect(result.stock).toBe(4);
      expect(result.low_stock).toBe(true);
    });

    it("low_stock=false saat stock tepat 5 (boundary)", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockResolvedValue(
        variantRow({ stock: 5 }) as any,
      );

      const result = await createVariantService(
        PRODUCT_ID,
        baseInput({ stock: 5 }),
        ADMIN_ID,
      );

      expect(result.low_stock).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Business rules (fast-fail, tanpa DB)
  // ═══════════════════════════════════════════════════════════════
  describe("business rules — fast-fail tanpa menyentuh DB", () => {
    it("size & color dua-duanya null → ATTRIBUTE_REQUIRED, tanpa DB", async () => {
      // Tidak panggil setupTx — kita verifikasi transaction TIDAK dipanggil.
      await expect(
        createVariantService(
          PRODUCT_ID,
          baseInput({ size: null, color: null }),
          ADMIN_ID,
        ),
      ).rejects.toMatchObject({
        code: "ATTRIBUTE_REQUIRED",
        statusCode: 400,
      });

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("price 0 → INVALID_PRICE, tanpa DB", async () => {
      await expect(
        createVariantService(PRODUCT_ID, baseInput({ price: 0 }), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "INVALID_PRICE",
        statusCode: 400,
      });

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("price negatif → INVALID_PRICE, tanpa DB", async () => {
      await expect(
        createVariantService(PRODUCT_ID, baseInput({ price: -100 }), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "INVALID_PRICE",
        statusCode: 400,
      });

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("stock negatif → INVALID_STOCK, tanpa DB", async () => {
      await expect(
        createVariantService(PRODUCT_ID, baseInput({ stock: -1 }), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "INVALID_STOCK",
        statusCode: 400,
      });

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("error business adalah instance AppError (global handler bisa mapping)", async () => {
      try {
        await createVariantService(
          PRODUCT_ID,
          baseInput({ size: null, color: null }),
          ADMIN_ID,
        );
        expect.fail("harus throw");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Product not found / soft-deleted
  // ═══════════════════════════════════════════════════════════════
  describe("product not found", () => {
    it("locked.length=0 → PRODUCT_NOT_FOUND, insert tidak dipanggil", async () => {
      const tx = setupTx({ locked: [] });

      await expect(
        createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "PRODUCT_NOT_FOUND",
        statusCode: 404,
      });

      expect(tx.productVariant.create).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Race P2002 → SKU_DUPLICATE / VARIANT_DUPLICATE
  // ═══════════════════════════════════════════════════════════════
  describe("race P2002 — unique violation mapping", () => {
    it("P2002 meta.constraint=ProductVariant_sku_key → SKU_DUPLICATE", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockRejectedValue(
        makeP2002({ constraint: "ProductVariant_sku_key" }),
      );

      await expect(
        createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "SKU_DUPLICATE",
        statusCode: 409,
        message: "SKU is already in use",
      });
    });

    it("P2002 meta.target=['sku'] (format Prisma lama) → SKU_DUPLICATE", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockRejectedValue(
        makeP2002({ target: ["sku"] }),
      );

      await expect(
        createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "SKU_DUPLICATE",
        statusCode: 409,
      });
    });

    it("P2002 meta.constraint=ProductVariant_product_size_color_active_key → VARIANT_DUPLICATE", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockRejectedValue(
        makeP2002({
          constraint: "ProductVariant_product_size_color_active_key",
        }),
      );

      await expect(
        createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "VARIANT_DUPLICATE",
        statusCode: 409,
        message: "A variant with the same size and color already exists",
      });
    });

    it("P2002 meta.target=['product_id','size','color'] → VARIANT_DUPLICATE", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockRejectedValue(
        makeP2002({ target: ["product_id", "size", "color"] }),
      );

      await expect(
        createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "VARIANT_DUPLICATE",
        statusCode: 409,
      });
    });

    it("P2002 dengan meta unknown → fallback VARIANT_DUPLICATE (fail-safe 409)", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockRejectedValue(
        makeP2002({ some_new_constraint: "whatever" }),
      );

      await expect(
        createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID),
      ).rejects.toMatchObject({
        code: "VARIANT_DUPLICATE",
        statusCode: 409,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Error passthrough (non-P2002)
  // ═══════════════════════════════════════════════════════════════
  describe("error passthrough", () => {
    it("Prisma error non-P2002 → re-throw as-is", async () => {
      const tx = setupTx();
      const original = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "test",
          meta: { field_name: "createdBy" },
        },
      );
      tx.productVariant.create.mockRejectedValue(original);

      await expect(
        createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID),
      ).rejects.toBe(original);
    });

    it("error non-Prisma → re-throw as-is", async () => {
      const tx = setupTx();
      const original = new Error("connection lost");
      tx.productVariant.create.mockRejectedValue(original);

      await expect(
        createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID),
      ).rejects.toBe(original);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Security & race guard
  // ═══════════════════════════════════════════════════════════════
  describe("security & race guard", () => {
    it("createdBy & updatedBy diambil dari adminId — payload tidak dipakai", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockResolvedValue(variantRow() as any);

      // Payload berisi created_by palsu — schema sudah strip sebelum
      // sampai service, tapi test ini buktikan service pun tidak
      // mempercayai input. Actor di-set dari argumen `adminId`.
      const malicious = {
        ...baseInput(),
        created_by: "attacker-id",
        updated_by: "attacker-id",
      } as any;

      await createVariantService(PRODUCT_ID, malicious, ADMIN_ID);

      const data = tx.productVariant.create.mock.calls[0][0].data as any;
      expect(data.createdBy).toBe(ADMIN_ID);
      expect(data.updatedBy).toBe(ADMIN_ID);
      expect(data.createdBy).not.toBe("attacker-id");
    });

    it("SELECT FOR UPDATE memuat deleted_at IS NULL (race-guard soft-delete concurrent)", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockResolvedValue(variantRow() as any);

      await createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID);

      const strings = tx.$queryRaw.mock
        .calls[0][0] as unknown as TemplateStringsArray;
      const sql = strings.join("?").replace(/\s+/g, " ").trim();

      // Filter deleted_at & FOR UPDATE — kunci race-safety.
      expect(sql).toMatch(/FOR UPDATE/i);
      expect(sql).toMatch(/deleted_at IS NULL/i);
      expect(sql).toMatch(/WHERE id = \?/i);
    });

    it("productId di-parameterize (bukan interpolasi SQL string)", async () => {
      const tx = setupTx();
      tx.productVariant.create.mockResolvedValue(variantRow() as any);

      await createVariantService(PRODUCT_ID, baseInput(), ADMIN_ID);

      // Nilai productId masuk sebagai binding argumen, bukan di SQL.
      const values = tx.$queryRaw.mock.calls[0].slice(1);
      expect(values).toContain(PRODUCT_ID);

      const strings = tx.$queryRaw.mock
        .calls[0][0] as unknown as TemplateStringsArray;
      const sql = strings.join("?").replace(/\s+/g, " ").trim();
      expect(sql).not.toContain(PRODUCT_ID);
    });
  });
});
