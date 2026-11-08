// tests/unit-test/product_v2/product.service.upload-image.unit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadImageService } from "../../../src/modules/product_v2/product_v2.service";

vi.mock("../../../src/config/env", () => ({
  env: {
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-key",
    CLOUDINARY_API_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test",
    NODE_ENV: "test",
  },
}));

// ── Mock Prisma & Cloudinary ────────────────────────────────────────
// Service memakai:
//  - prisma.product.findFirst       → pre-check (fast-fail)
//  - prisma.$transaction            → fase insert (lock + create)
//  - uploadBufferToCloudinary       → upload Cloudinary
//  - deleteFromCloudinary           → compensating delete
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    product: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../../src/lib/cloudinary-uploader", () => ({
  uploadBufferToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn(),
}));

import { prisma } from "../../../src/lib/prisma";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../../../src/lib/cloudinary-uploader";

const mockProductFind = vi.mocked(prisma.product.findFirst);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockUpload = vi.mocked(uploadBufferToCloudinary);
const mockDelete = vi.mocked(deleteFromCloudinary);

const ADMIN_ID = "00000000-0000-0000-0000-00000000ad01";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

const VALID_FILE = {
  buffer: Buffer.from("fake-image-bytes"),
  mimetype: "image/png",
  size: 1024,
};

const CLOUDINARY_RESULT = {
  url: "https://res.cloudinary.com/test/products/xxx/uuid.png",
  publicId: "products/xxx/uuid",
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Setup fake `tx` untuk fase insert. Default: lock sukses, no primary
 * existing, create sukses → happy path first upload.
 */
function setupTx(
  opts: {
    locked?: Array<{ id: string }>;
    existingPrimary?: { id: string } | null;
    createRow?: Record<string, unknown>;
  } = {},
) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue(opts.locked ?? [{ id: PRODUCT_ID }]),
    productImage: {
      findFirst: vi.fn().mockResolvedValue(opts.existingPrimary ?? null),
      create: vi.fn(),
    },
  };
  const isPrimary = opts.existingPrimary == null;
  tx.productImage.create.mockResolvedValue(
    (opts.createRow ?? {
      id: "image-uuid",
      url: CLOUDINARY_RESULT.url,
      isPrimary,
      sortOrder: 0,
    }) as any,
  );
  mockTransaction.mockImplementation(((cb: any) => cb(tx)) as any);
  return tx;
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

describe("uploadImageService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 1 — Input guard
  // ═══════════════════════════════════════════════════════════════
  describe("empty file guard", () => {
    it("size=0 → VALIDATION_ERROR, tanpa sentuh DB maupun Cloudinary", async () => {
      await expect(
        uploadImageService(
          PRODUCT_ID,
          { buffer: Buffer.alloc(0), mimetype: "image/png", size: 0 },
          ADMIN_ID,
        ),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });

      // Fast-fail — sebelum pre-check maupun upload.
      expect(mockProductFind).not.toHaveBeenCalled();
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Pre-check product
  // ═══════════════════════════════════════════════════════════════
  describe("pre-check product", () => {
    it("product not found → PRODUCT_NOT_FOUND, uploadBufferToCloudinary TIDAK dipanggil", async () => {
      mockProductFind.mockResolvedValue(null);

      await expect(
        uploadImageService(PRODUCT_ID, VALID_FILE, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "PRODUCT_NOT_FOUND",
        statusCode: 404,
      });

      // Pre-check memakai filter `deletedAt: null` (BR-05).
      expect(mockProductFind).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID, deletedAt: null },
        select: { id: true },
      });

      // Fast-fail — tidak hit Cloudinary (hemat quota).
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Happy paths
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths", () => {
    it("first image → is_primary=true, folder `products/{id}`, fileKey=publicId", async () => {
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);
      const tx = setupTx({ existingPrimary: null });

      const result = await uploadImageService(PRODUCT_ID, VALID_FILE, ADMIN_ID);

      // Cloudinary dipanggil dengan buffer + folder per produk.
      expect(mockUpload).toHaveBeenCalledWith(
        VALID_FILE.buffer,
        `products/${PRODUCT_ID}`,
      );

      // `fileKey` = publicId Cloudinary (bukan url, bukan originalname).
      expect(tx.productImage.create).toHaveBeenCalledWith({
        data: {
          productId: PRODUCT_ID,
          url: CLOUDINARY_RESULT.url,
          fileKey: CLOUDINARY_RESULT.publicId,
          isPrimary: true,
          sortOrder: 0,
          createdBy: ADMIN_ID,
        },
        select: expect.any(Object),
      });

      // DTO: snake_case, is_primary sesuai first upload.
      expect(result).toEqual({
        id: "image-uuid",
        url: CLOUDINARY_RESULT.url,
        is_primary: true,
        sort_order: 0,
      });
    });

    it("second image (existing primary ada) → is_primary=false", async () => {
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);
      const tx = setupTx({ existingPrimary: { id: "existing-primary" } });

      const result = await uploadImageService(PRODUCT_ID, VALID_FILE, ADMIN_ID);

      expect(tx.productImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPrimary: false }),
        }),
      );
      expect(result.is_primary).toBe(false);
    });

    it("response TIDAK memuat fileKey / publicId / productId (anti-leak)", async () => {
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);
      setupTx();

      const result = await uploadImageService(PRODUCT_ID, VALID_FILE, ADMIN_ID);

      // Field internal tidak boleh bocor.
      expect(result).not.toHaveProperty("fileKey");
      expect(result).not.toHaveProperty("publicId");
      expect(result).not.toHaveProperty("productId");
      expect(result).not.toHaveProperty("createdBy");
      expect(result).not.toHaveProperty("createdAt");

      // Field kontrak PRD wajib ada.
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("is_primary");
      expect(result).toHaveProperty("sort_order");
    });

    it("buffer & mimetype diteruskan ke Cloudinary apa adanya (tidak diubah)", async () => {
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);
      setupTx();

      const customFile = {
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        mimetype: "image/jpeg",
        size: 4,
      };

      await uploadImageService(PRODUCT_ID, customFile, ADMIN_ID);

      // Buffer identity (same Buffer reference) & mimetype tidak di-transform.
      expect(mockUpload).toHaveBeenCalledWith(
        customFile.buffer,
        `products/${PRODUCT_ID}`,
      );
      expect(mockUpload.mock.calls[0][0]).toBe(customFile.buffer);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Race at insert phase (product soft-deleted mid-flight)
  // ═══════════════════════════════════════════════════════════════
  describe("race at insert phase", () => {
    it("lock kosong (product soft-deleted antara pre-check & insert) → PRODUCT_NOT_FOUND + compensating delete", async () => {
      // Pre-check lolos (product terlihat ada).
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);
      // Lock mengembalikan 0 rows (product sudah soft-deleted sebelum FOR UPDATE).
      const tx = setupTx({ locked: [] });
      mockDelete.mockResolvedValue(undefined);

      await expect(
        uploadImageService(PRODUCT_ID, VALID_FILE, ADMIN_ID),
      ).rejects.toMatchObject({
        code: "PRODUCT_NOT_FOUND",
        statusCode: 404,
      });

      // Insert tidak dipanggil — lock kosong = fail sebelum create.
      expect(tx.productImage.create).not.toHaveBeenCalled();

      // Compensating delete — file Cloudinary yang sudah ter-upload
      // dibersihkan agar tidak jadi orphan.
      expect(mockDelete).toHaveBeenCalledWith(CLOUDINARY_RESULT.publicId);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Compensating delete
  // ═══════════════════════════════════════════════════════════════
  describe("compensating delete", () => {
    it("DB create throws → deleteFromCloudinary dipanggil dengan publicId, original error rethrown", async () => {
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);

      const dbError = new Error("DB connection lost");
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: PRODUCT_ID }]),
        productImage: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockRejectedValue(dbError),
        },
      };
      mockTransaction.mockImplementation(((cb: any) => cb(tx)) as any);
      mockDelete.mockResolvedValue(undefined);

      await expect(
        uploadImageService(PRODUCT_ID, VALID_FILE, ADMIN_ID),
      ).rejects.toBe(dbError);

      // Cloudinary file dibersihkan (compensating).
      expect(mockDelete).toHaveBeenCalledWith(CLOUDINARY_RESULT.publicId);
      // Error asli di-rethrow (bukan di-mask).
    });

    it("deleteFromCloudinary gagal → warning logged, error original TETAP rethrown", async () => {
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);

      const dbError = new Error("DB connection lost");
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: PRODUCT_ID }]),
        productImage: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockRejectedValue(dbError),
        },
      };
      mockTransaction.mockImplementation(((cb: any) => cb(tx)) as any);

      const cleanupError = new Error("Cloudinary cleanup failed");
      mockDelete.mockRejectedValue(cleanupError);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Error yang di-throw ke caller tetap `dbError` — bukan cleanup error.
      await expect(
        uploadImageService(PRODUCT_ID, VALID_FILE, ADMIN_ID),
      ).rejects.toBe(dbError);

      // Warning di-log (untuk observability orphan file).
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — SQL & Security
  // ═══════════════════════════════════════════════════════════════
  describe("SQL & security", () => {
    it("lock query: FOR UPDATE + deleted_at IS NULL + productId parameterized", async () => {
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);
      const tx = setupTx();

      await uploadImageService(PRODUCT_ID, VALID_FILE, ADMIN_ID);

      const sql = capturedSql(tx, 0);
      expect(sql).toContain('FROM "Product"');
      expect(sql).toMatch(/FOR UPDATE/i);
      expect(sql).toMatch(/deleted_at IS NULL/i);

      // SQL string tidak memuat productId mentah (parameterized).
      expect(sql).not.toContain(PRODUCT_ID);

      // productId masuk sebagai binding value.
      const values = tx.$queryRaw.mock.calls[0].slice(1);
      expect(values).toContain(PRODUCT_ID);
    });

    it("createdBy dari adminId (bukan dari file/input), sortOrder default 0", async () => {
      mockProductFind.mockResolvedValue({ id: PRODUCT_ID } as any);
      mockUpload.mockResolvedValue(CLOUDINARY_RESULT);
      const tx = setupTx();

      // Admin ID berbeda dari yang "mungkin" ada di file/input —
      // service hanya boleh pakai `adminId` argumen.
      const DIFFERENT_ADMIN_ID = "99999999-9999-4999-8999-999999999999";

      await uploadImageService(PRODUCT_ID, VALID_FILE, DIFFERENT_ADMIN_ID);

      const data = tx.productImage.create.mock.calls[0][0].data as any;
      expect(data.createdBy).toBe(DIFFERENT_ADMIN_ID);
      expect(data.sortOrder).toBe(0);
      // File tidak menyimpan `originalname` atau metadata client lain ke DB.
      expect(data).not.toHaveProperty("originalName");
      expect(data).not.toHaveProperty("mimetype");
    });
  });
});
