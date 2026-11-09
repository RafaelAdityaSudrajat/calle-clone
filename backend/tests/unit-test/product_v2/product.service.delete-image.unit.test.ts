// tests/unit-test/product_v2/product.service.delete-image.unit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteImageService } from "../../../src/modules/product_v2/product_v2.service";

// ── Mock Prisma & Cloudinary ────────────────────────────────────────
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

// ⚠️ Path: kalau tidak rename, ganti ke `cloudinary` (tanpa `-uploader`).
vi.mock("../../../src/lib/cloudinary-uploader", () => ({
  deleteFromCloudinary: vi.fn(),
  uploadBufferToCloudinary: vi.fn(), // not used, tapi untuk keselarasan
}));

import { prisma } from "../../../src/lib/prisma";
import { deleteFromCloudinary } from "../../../src/lib/cloudinary-uploader";

const mockTransaction = vi.mocked(prisma.$transaction);
const mockDelete = vi.mocked(deleteFromCloudinary);

const ADMIN_ID = "00000000-0000-0000-0000-00000000ad01";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "33333333-3333-4333-8333-333333333333";

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Setup fake `tx` untuk transaksi delete image.
 *
 * Default: produk ACTIVE, image primary, hanya 1 image tersisa →
 * memicu BR-20 auto-INACTIVE.
 */
function setupTx(
  opts: {
    productLocked?: Array<{ id: string; status: string }>;
    imageLocked?: Array<{ id: string; is_primary: boolean; file_key: string }>;
    newPrimary?: { id: string } | null;
    remainingCount?: number;
  } = {},
) {
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce(
        opts.productLocked ?? [{ id: PRODUCT_ID, status: "ACTIVE" }],
      )
      .mockResolvedValueOnce(
        opts.imageLocked ?? [
          {
            id: IMAGE_ID,
            is_primary: true,
            file_key: "products/xxx/file-key-1",
          },
        ],
      ),
    productImage: {
      delete: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(opts.newPrimary ?? null),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(opts.remainingCount ?? 0),
    },
    product: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
  mockTransaction.mockImplementation(((cb: any) => cb(tx)) as any);
  return tx;
}

function capturedSql(
  tx: ReturnType<typeof setupTx>,
  callIndex: number,
): string {
  const strings = tx.$queryRaw.mock.calls[
    callIndex
  ][0] as unknown as TemplateStringsArray;
  return strings.join("?").replace(/\s+/g, " ").trim();
}

// ── Test suite ──────────────────────────────────────────────────────

describe("deleteImageService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDelete.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 1 — Not found (product / image)
  // ═══════════════════════════════════════════════════════════════
  describe("not found", () => {
    it("product lock kosong → PRODUCT_NOT_FOUND, image lock tidak dipanggil, Cloudinary tidak disentuh", async () => {
      const tx = setupTx({ productLocked: [] });

      await expect(
        deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "PRODUCT_NOT_FOUND",
        statusCode: 404,
      });

      // Fast-fail: hanya 1 $queryRaw (product lock).
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.productImage.delete).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("image lock kosong → IMAGE_NOT_FOUND (IDOR / not-found / already-deleted), tanpa write, tanpa Cloudinary", async () => {
      const tx = setupTx({ imageLocked: [] });

      await expect(
        deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "IMAGE_NOT_FOUND",
        statusCode: 404,
      });

      // 2x $queryRaw (product + image lock), tidak ada write.
      expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(tx.productImage.delete).not.toHaveBeenCalled();
      // Tidak ada Cloudinary delete (transaksi abort sebelum commit).
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Happy path: delete non-primary (no auto-pick)
  // ═══════════════════════════════════════════════════════════════
  describe("happy path — delete non-primary", () => {
    it("image non-primary → tidak cari candidate, status produk tidak berubah, Cloudinary dihapus", async () => {
      const tx = setupTx({
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: false,
            file_key: "products/xxx/non-primary",
          },
        ],
        remainingCount: 1, // masih ada 1 image lain
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      // Hard delete tetap dijalankan.
      expect(tx.productImage.delete).toHaveBeenCalledWith({
        where: { id: IMAGE_ID },
      });

      // Skip step 4 (bukan primary) — findFirst tidak dipanggil.
      expect(tx.productImage.findFirst).not.toHaveBeenCalled();
      // Skip step 4b (tidak ada update image).
      expect(tx.productImage.update).not.toHaveBeenCalled();

      // Skip step 5 (remaining > 0) — product tidak di-update.
      expect(tx.product.update).not.toHaveBeenCalled();

      // Cloudinary delete dengan file_key dari DB (bukan url).
      expect(mockDelete).toHaveBeenCalledWith("products/xxx/non-primary");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — BR-20 auto-pick new primary
  // ═══════════════════════════════════════════════════════════════
  describe("BR-20 — auto-pick new primary", () => {
    it("image primary + ada image lain → new primary di-set (order: delete dulu, set sesudah)", async () => {
      const tx = setupTx({
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: true,
            file_key: "products/xxx/old-primary",
          },
        ],
        newPrimary: { id: "candidate-image-id" },
        remainingCount: 1, // setelah delete masih 1
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      // DELETE harus dipanggil sebelum findFirst (partial unique
      // index Postgres check per-row → DELETE dulu baru SET).
      const deleteOrder = tx.productImage.delete.mock.invocationCallOrder[0];
      const findFirstOrder =
        tx.productImage.findFirst.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(findFirstOrder);

      // Candidate di-fetch dengan order deterministik.
      expect(tx.productImage.findFirst).toHaveBeenCalledWith({
        where: { productId: PRODUCT_ID },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true },
      });

      // Update candidate jadi primary.
      expect(tx.productImage.update).toHaveBeenCalledWith({
        where: { id: "candidate-image-id" },
        data: { isPrimary: true },
      });
    });

    it("image primary + 0 image tersisa → tidak ada findFirst update (skip step 4b)", async () => {
      const tx = setupTx({
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: true,
            file_key: "products/xxx/only",
          },
        ],
        newPrimary: null, // tidak ada candidate
        remainingCount: 0,
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      // findFirst tetap dipanggil (karena is_primary = true), return null.
      expect(tx.productImage.findFirst).toHaveBeenCalled();
      // Tidak ada update candidate (newPrimary null).
      expect(tx.productImage.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — BR-20 auto-INACTIVE
  // ═══════════════════════════════════════════════════════════════
  describe("BR-20 — auto-INACTIVE (last image)", () => {
    it("last image + status ACTIVE → product status jadi INACTIVE + updatedBy=adminId", async () => {
      const tx = setupTx({
        productLocked: [{ id: PRODUCT_ID, status: "ACTIVE" }],
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: true,
            file_key: "products/xxx/only",
          },
        ],
        newPrimary: null,
        remainingCount: 0,
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { status: "INACTIVE", updatedBy: ADMIN_ID },
      });
    });

    it("last image + status DRAFT → status TIDAK berubah", async () => {
      const tx = setupTx({
        productLocked: [{ id: PRODUCT_ID, status: "DRAFT" }],
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: true,
            file_key: "products/xxx/only",
          },
        ],
        newPrimary: null,
        remainingCount: 0,
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      // BR-20: hanya ACTIVE yang di-transition ke INACTIVE.
      expect(tx.product.update).not.toHaveBeenCalled();
    });

    it("last image + status INACTIVE → status TIDAK berubah (idempotent)", async () => {
      const tx = setupTx({
        productLocked: [{ id: PRODUCT_ID, status: "INACTIVE" }],
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: true,
            file_key: "products/xxx/only",
          },
        ],
        newPrimary: null,
        remainingCount: 0,
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      expect(tx.product.update).not.toHaveBeenCalled();
    });

    it("bukan last image (remaining > 0) + status ACTIVE → status TIDAK berubah", async () => {
      const tx = setupTx({
        productLocked: [{ id: PRODUCT_ID, status: "ACTIVE" }],
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: false,
            file_key: "products/xxx/non-primary",
          },
        ],
        remainingCount: 1,
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      // Bukan last image → BR-20 tidak trigger meski ACTIVE.
      expect(tx.product.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Cloudinary cleanup
  // ═══════════════════════════════════════════════════════════════
  describe("Cloudinary cleanup", () => {
    it("deleteFromCloudinary dipanggil dengan file_key (bukan url)", async () => {
      setupTx({
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: false,
            file_key: "products/abc/uuid-file-key",
          },
        ],
        remainingCount: 1,
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      // file_key (Cloudinary publicId), bukan url.
      expect(mockDelete).toHaveBeenCalledWith("products/abc/uuid-file-key");
    });

    it("Cloudinary delete sukses → warning log TIDAK muncul", async () => {
      setupTx({ remainingCount: 1 });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("Cloudinary delete gagal → warning logged, error TIDAK di-rethrow (DB tetap sukses)", async () => {
      setupTx({ remainingCount: 1 });
      const cleanupError = new Error("Cloudinary 503");
      mockDelete.mockRejectedValue(cleanupError);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Fungsi tetap resolve (tidak throw) — DELETE DB sudah commit,
      // orpham file di Cloudinary adalah tanggung jawab cleanup job.
      await expect(
        deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID),
      ).resolves.toBeUndefined();

      // Warning logged untuk observability.
      expect(warnSpy).toHaveBeenCalled();
      const warnArgs = warnSpy.mock.calls[0];
      expect(warnArgs[0]).toMatch(/Cloudinary cleanup failed/);
      expect(warnArgs[1]).toMatchObject({
        publicId: expect.any(String),
        error: cleanupError,
      });

      warnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — SQL & Security
  // ═══════════════════════════════════════════════════════════════
  describe("SQL & security", () => {
    it("product lock: FOR UPDATE + deleted_at IS NULL + productId parameterized", async () => {
      const tx = setupTx({ remainingCount: 1 });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      const productSql = capturedSql(tx, 0);
      expect(productSql).toContain('FROM "Product"');
      expect(productSql).toMatch(/FOR UPDATE/i);
      expect(productSql).toMatch(/deleted_at IS NULL/i);
      // Parameterized — bukan string interpolation.
      expect(productSql).not.toContain(PRODUCT_ID);
      const values = tx.$queryRaw.mock.calls[0].slice(1);
      expect(values).toContain(PRODUCT_ID);
    });

    it("image lock: FOR UPDATE + IDOR guard (product_id = productId) + imageId parameterized", async () => {
      const tx = setupTx({ remainingCount: 1 });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      const imageSql = capturedSql(tx, 1);
      expect(imageSql).toContain('FROM "ProductImage"');
      expect(imageSql).toMatch(/FOR UPDATE/i);
      // IDOR guard — tanpa filter ini, image milik produk lain bisa
      // dihapus lewat cross-product request.
      expect(imageSql).toMatch(/product_id = \?/i);
      expect(imageSql).toMatch(/id = \?/i);
      // Parameterized.
      expect(imageSql).not.toContain(IMAGE_ID);
      expect(imageSql).not.toContain(PRODUCT_ID);
      const values = tx.$queryRaw.mock.calls[1].slice(1);
      expect(values).toContain(IMAGE_ID);
      expect(values).toContain(PRODUCT_ID);
    });

    it("lock ordering: product dulu, baru image (cegah deadlock)", async () => {
      const tx = setupTx({ remainingCount: 1 });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID);

      // Urutan pemanggilan $queryRaw: call 0 = product, call 1 = image.
      const calls = tx.$queryRaw.mock.calls;
      expect(calls).toHaveLength(2);
      const firstSql = (calls[0][0] as unknown as TemplateStringsArray).join(
        "?",
      );
      const secondSql = (calls[1][0] as unknown as TemplateStringsArray).join(
        "?",
      );
      expect(firstSql).toContain('FROM "Product"');
      expect(secondSql).toContain('FROM "ProductImage"');
    });

    it("updatedBy diambil dari adminId (bukan payload) — BR-26 audit trail", async () => {
      const DIFFERENT_ADMIN_ID = "99999999-9999-4999-8999-999999999999";
      const tx = setupTx({
        productLocked: [{ id: PRODUCT_ID, status: "ACTIVE" }],
        imageLocked: [
          {
            id: IMAGE_ID,
            is_primary: true,
            file_key: "products/xxx/only",
          },
        ],
        newPrimary: null,
        remainingCount: 0,
      });

      await deleteImageService(PRODUCT_ID, IMAGE_ID, DIFFERENT_ADMIN_ID);

      const updateData = tx.product.update.mock.calls[0][0].data as any;
      expect(updateData.updatedBy).toBe(DIFFERENT_ADMIN_ID);
      // Status yang di-set adalah INACTIVE (BR-20).
      expect(updateData.status).toBe("INACTIVE");
    });

    it("tidak ada write setelah product lock kosong (fast-fail)", async () => {
      const tx = setupTx({ productLocked: [] });

      await expect(
        deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID),
      ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });

      // Tidak ada write sama sekali.
      expect(tx.productImage.delete).not.toHaveBeenCalled();
      expect(tx.productImage.update).not.toHaveBeenCalled();
      expect(tx.product.update).not.toHaveBeenCalled();
      // Cloudinary tidak tersentuh.
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("tidak ada Cloudinary delete saat transaksi throw (rollback)", async () => {
      // Lock image kosong → throw di tengah transaksi.
      setupTx({ imageLocked: [] });

      await expect(
        deleteImageService(PRODUCT_ID, IMAGE_ID, ADMIN_ID),
      ).rejects.toMatchObject({ code: "IMAGE_NOT_FOUND" });

      // Cloudinary delete HANYA dipanggil setelah commit sukses.
      // Transaksi abort → tidak boleh ada cleanup file (transaksi
      // di-rollback, file tidak pernah "dihapus" dari perspektif client).
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
