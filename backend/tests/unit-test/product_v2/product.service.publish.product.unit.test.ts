// src/modules/product/publish-product.service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { publishProductService } from "../../../src/modules/product_v2/product_v2.service";

// ── Mock Prisma client ──────────────────────────────────────────────
// Method yang dipakai publishProductService:
//  - product.findFirst → read snapshot + disambiguasi setelah affected=0
//  - $executeRaw       → transisi atomik (tagged template)
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    product: { findFirst: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

// Import SETELAH mock dideklarasikan (hoisted oleh vitest).
import { prisma } from "../../../src/lib/prisma";
import { AppError } from "../../../src/lib/errors";

const mockFindFirst = vi.mocked(prisma.product.findFirst);
const mockExecuteRaw = vi.mocked(prisma.$executeRaw);

const ADMIN_ID = "00000000-0000-0000-0000-00000000ad01";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

/**
 * Bangun row snapshot untuk `product.findFirst`.
 * Default: DRAFT yang lolos semua syarat BR-07 (1 varian, 1 primary
 * image, harga valid, kategori ada) — tiap test cukup override field
 * yang relevan.
 */
function snapshot(
  overrides: Partial<{
    id: string;
    status: "DRAFT" | "ACTIVE" | "INACTIVE";
    categoryId: string | null;
    variants: Array<{ id: string; price: unknown }>;
    images: Array<{ id: string; isPrimary: boolean }>;
  }> = {},
) {
  return {
    id: PRODUCT_ID,
    status: "DRAFT" as const,
    categoryId: CATEGORY_ID,
    variants: [{ id: "v1", price: 50000 }],
    images: [{ id: "i1", isPrimary: true }],
    ...overrides,
  };
}

/**
 * Ambil daftar `code` dari multi-error `AppError.details` (array).
 * Mengembalikan [] kalau details bukan array (single-error) — supaya
 * assertion tidak crash kalau suatu saat factory berubah.
 */
function codesOf(err: unknown): string[] {
  const e = err as AppError;
  if (!Array.isArray(e.details)) return [];
  return (e.details as Array<{ code: string }>).map((d) => d.code);
}

/**
 * Ambil SQL string dari call `$executeRaw` (gabungkan template strings
 * dengan `?` sebagai placeholder interpolation). Dipakai untuk assert
 * bahwa WHERE memuat semua syarat BR-07 — regresi paling berbahaya
 * di service ini adalah filter yang tidak sengaja terhapus.
 */
function capturedSql(): string {
  const strings = mockExecuteRaw.mock
    .calls[0][0] as unknown as TemplateStringsArray;
  return strings.join("?").replace(/\s+/g, " ").trim();
}

describe("publishProductService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── Case 1: Happy path ────────────────────────────────────────
  it("publish sukses — $executeRaw dipanggil sekali, return { id, status: ACTIVE }", async () => {
    mockFindFirst.mockResolvedValue(snapshot() as any);
    mockExecuteRaw.mockResolvedValue(1);

    const result = await publishProductService(PRODUCT_ID, ADMIN_ID);

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: PRODUCT_ID, status: "ACTIVE" });

    // Read snapshot dipanggil sekali (tidak ada re-read saat sukses).
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  // ── Case 2: SQL memuat semua syarat BR-07 di WHERE ───────────
  it("WHERE SQL memuat semua filter BR-07 (status, deletedAt, category, EXISTS variant, NOT EXISTS bad price, EXISTS primary image)", async () => {
    mockFindFirst.mockResolvedValue(snapshot() as any);
    mockExecuteRaw.mockResolvedValue(1);

    await publishProductService(PRODUCT_ID, ADMIN_ID);

    const sql = capturedSql();
    // Status transitions
    expect(sql).toContain(`"status" = 'ACTIVE'`);
    expect(sql).toContain(`"status" = 'DRAFT'`);
    // Soft-delete-safe (BR-05)
    expect(sql).toContain(`"deleted_at" IS NULL`);
    // Category required (BR-24)
    expect(sql).toContain(`"category_id" IS NOT NULL`);
    // Variant exists (BR-07)
    expect(sql).toMatch(/EXISTS\s*\(\s*SELECT 1 FROM "ProductVariant"/);
    // Bad price must not exist (BR-07 / BR-15)
    expect(sql).toMatch(/NOT EXISTS\s*\(\s*SELECT 1 FROM "ProductVariant"/);
    expect(sql).toContain(`"price" <= 0`);
    // Primary image exists (BR-18)
    expect(sql).toMatch(/EXISTS\s*\(\s*SELECT 1 FROM "ProductImage"/);
    expect(sql).toContain(`"is_primary" = true`);
  });

  // ── Case 3: Parameter interpolasi aman ──────────────────────
  it("$executeRaw di-parameterize — adminId & id masuk sebagai binding, bukan literal string", async () => {
    mockFindFirst.mockResolvedValue(snapshot() as any);
    mockExecuteRaw.mockResolvedValue(1);

    await publishProductService(PRODUCT_ID, ADMIN_ID);

    // `calls[0]` = [stringsArray, ...values].
    const values = mockExecuteRaw.mock.calls[0].slice(1);
    expect(values).toContain(ADMIN_ID);
    expect(values).toContain(PRODUCT_ID);

    // adminId hanya muncul sebagai binding, TIDAK di template string.
    const sql = capturedSql();
    expect(sql).not.toContain(ADMIN_ID);
    expect(sql).not.toContain(PRODUCT_ID);
  });

  // ── Case 4: Product tidak ada ────────────────────────────────
  it("product tidak ada — PRODUCT_NOT_FOUND, $executeRaw tidak dipanggil", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      publishProductService(PRODUCT_ID, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404,
    });

    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  // ── Case 5: Status ACTIVE ────────────────────────────────────
  it("produk ACTIVE — INVALID_STATUS_TRANSITION, tidak ada write", async () => {
    mockFindFirst.mockResolvedValue(snapshot({ status: "ACTIVE" }) as any);

    await expect(
      publishProductService(PRODUCT_ID, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      statusCode: 400,
    });

    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  // ── Case 6: Status INACTIVE (publish DRAFT-only) ────────────
  it("produk INACTIVE — INVALID_STATUS_TRANSITION (publish DRAFT-only, republish lewat endpoint lain)", async () => {
    mockFindFirst.mockResolvedValue(snapshot({ status: "INACTIVE" }) as any);

    await expect(
      publishProductService(PRODUCT_ID, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      statusCode: 400,
    });

    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  // ── Case 7: Tanpa varian ─────────────────────────────────────
  it("tanpa varian — multi-error hanya PRODUCT_NEEDS_VARIANT", async () => {
    mockFindFirst.mockResolvedValue(snapshot({ variants: [] }) as any);

    let captured: unknown;
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(AppError);
    expect(codesOf(captured)).toEqual(["PRODUCT_NEEDS_VARIANT"]);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  // ── Case 8: Tanpa gambar — 2 kode (EC-PM-B3) ────────────────
  it("tanpa gambar — NEEDS_IMAGE + NEEDS_PRIMARY_IMAGE sekaligus", async () => {
    mockFindFirst.mockResolvedValue(snapshot({ images: [] }) as any);

    let captured: unknown;
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      captured = err;
    }

    expect(codesOf(captured)).toEqual([
      "PRODUCT_NEEDS_IMAGE",
      "PRODUCT_NEEDS_PRIMARY_IMAGE",
    ]);
  });

  // ── Case 9: Gambar ada, tidak ada primary (edge) ────────────
  it("gambar ada tapi tanpa primary — hanya NEEDS_PRIMARY_IMAGE", async () => {
    mockFindFirst.mockResolvedValue(
      snapshot({
        images: [
          { id: "i1", isPrimary: false },
          { id: "i2", isPrimary: false },
        ],
      }) as any,
    );

    let captured: unknown;
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      captured = err;
    }

    expect(codesOf(captured)).toEqual(["PRODUCT_NEEDS_PRIMARY_IMAGE"]);
  });

  // ── Case 10: Harga varian 0 (number) ────────────────────────
  it("salah satu varian harga 0 — INVALID_PRICE", async () => {
    mockFindFirst.mockResolvedValue(
      snapshot({
        variants: [
          { id: "v1", price: 50000 },
          { id: "v2", price: 0 },
        ],
      }) as any,
    );

    let captured: unknown;
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      captured = err;
    }

    expect(codesOf(captured)).toEqual(["INVALID_PRICE"]);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  // ── Case 11: Harga varian Decimal-string dari Prisma ────────
  it("harga Prisma Decimal(0) — terdeteksi INVALID_PRICE via Number()", async () => {
    mockFindFirst.mockResolvedValue(
      snapshot({
        variants: [{ id: "v1", price: { toString: () => "0" } }],
      }) as any,
    );

    let captured: unknown;
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      captured = err;
    }

    expect(codesOf(captured)).toEqual(["INVALID_PRICE"]);
  });

  // ── Case 12: Kategori null ───────────────────────────────────
  it("category_id null — CATEGORY_REQUIRED", async () => {
    mockFindFirst.mockResolvedValue(snapshot({ categoryId: null }) as any);

    let captured: unknown;
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      captured = err;
    }

    expect(codesOf(captured)).toEqual(["CATEGORY_REQUIRED"]);
  });

  // ── Case 13: Multiple errors sekaligus (EC-PM-B6) ───────────
  it("multiple errors (no variant + no image + no category) — order stabil", async () => {
    mockFindFirst.mockResolvedValue(
      snapshot({
        variants: [],
        images: [],
        categoryId: null,
      }) as any,
    );

    let captured: unknown;
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      captured = err;
    }

    // Urutan: variant → image → primary image → category.
    expect(codesOf(captured)).toEqual([
      "PRODUCT_NEEDS_VARIANT",
      "PRODUCT_NEEDS_IMAGE",
      "PRODUCT_NEEDS_PRIMARY_IMAGE",
      "CATEGORY_REQUIRED",
    ]);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  // ── Case 14: Race — affected=0, re-read ACTIVE ──────────────
  it("race concurrent publish — affected=0 & re-read ACTIVE → INVALID_STATUS_TRANSITION", async () => {
    mockFindFirst
      .mockResolvedValueOnce(snapshot({ status: "DRAFT" }) as any)
      .mockResolvedValueOnce(snapshot({ status: "ACTIVE" }) as any);
    mockExecuteRaw.mockResolvedValue(0);

    await expect(
      publishProductService(PRODUCT_ID, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      statusCode: 400,
    });

    // Read awal + re-read disambiguasi.
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
  });

  // ── Case 15: Race — affected=0, re-read null (soft-deleted) ─
  it("race soft-delete concurrent — affected=0 & re-read null → PRODUCT_NOT_FOUND", async () => {
    mockFindFirst
      .mockResolvedValueOnce(snapshot({ status: "DRAFT" }) as any)
      .mockResolvedValueOnce(null);
    mockExecuteRaw.mockResolvedValue(0);

    await expect(
      publishProductService(PRODUCT_ID, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404,
    });
  });

  // ── Case 16: Race — affected=0, re-read gagal validasi ──────
  it("race variant/image dihapus di tengah publish — affected=0 & re-read gagal validasi → multi-error akurat", async () => {
    // Read awal: semua syarat lolos. Update affected=0 (WHERE EXISTS
    // gagal karena varian dihapus setelah read). Re-read: varian
    // benar-benar sudah 0 di DB → multi-error yang akurat.
    mockFindFirst
      .mockResolvedValueOnce(snapshot() as any) // initial: valid
      .mockResolvedValueOnce(snapshot({ variants: [] }) as any); // re-read: no variant
    mockExecuteRaw.mockResolvedValue(0);

    let captured: unknown;
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      captured = err;
    }

    expect(codesOf(captured)).toEqual(["PRODUCT_NEEDS_VARIANT"]);
    // Re-read dipanggil karena affected=0.
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
  });

  // ── Case 17: Race — affected=0 tapi state konsisten (defensive) ─
  it("race sempit DRAFT→X→DRAFT — affected=0 & re-read valid → INTERNAL_ERROR (fail-closed)", async () => {
    // Skenario teoretis: state di read & re-read konsisten valid,
    // tapi WHERE gagal karena race siklus sangat sempit. Tidak
    // mungkin di produksi, tapi service harus fail-closed (bukan
    // return sukses palsu) supaya tidak melanggar invariant.
    mockFindFirst
      .mockResolvedValueOnce(snapshot({ status: "DRAFT" }) as any)
      .mockResolvedValueOnce(snapshot({ status: "DRAFT" }) as any);
    mockExecuteRaw.mockResolvedValue(0);

    await expect(
      publishProductService(PRODUCT_ID, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      statusCode: 500,
    });
  });

  // ── Case 18: Select minimal — variant filter BR-14 ──────────
  it("read snapshot memfilter variant deletedAt:null di nested select (BR-14)", async () => {
    mockFindFirst.mockResolvedValue(snapshot() as any);
    mockExecuteRaw.mockResolvedValue(1);

    await publishProductService(PRODUCT_ID, ADMIN_ID);

    const select = mockFindFirst.mock.calls[0][0]?.select as any;
    expect(select.variants.where).toEqual({ deletedAt: null });
  });

  // ── Case 19: Select minimal — product filter deletedAt:null ─
  it("read snapshot memfilter product deletedAt:null (BR-05)", async () => {
    mockFindFirst.mockResolvedValue(snapshot() as any);
    mockExecuteRaw.mockResolvedValue(1);

    await publishProductService(PRODUCT_ID, ADMIN_ID);

    const where = mockFindFirst.mock.calls[0][0]?.where as any;
    expect(where).toEqual({ id: PRODUCT_ID, deletedAt: null });
  });

  // ── Case 20: updated_by dari adminId (security) ─────────────
  it("updated_by di WHERE-SET diambil dari adminId — actor tidak bisa dipalsukan", async () => {
    mockFindFirst.mockResolvedValue(snapshot() as any);
    mockExecuteRaw.mockResolvedValue(1);

    await publishProductService(PRODUCT_ID, ADMIN_ID);

    // Nilai interpolasi: posisi pertama adalah adminId (SET updated_by).
    const values = mockExecuteRaw.mock.calls[0].slice(1);
    expect(values[0]).toBe(ADMIN_ID);
  });

  // ── Case 21: Error instance — multi-error & single-error ────
  it("error validasi & error status sama-sama instance AppError", async () => {
    // Multi-error (validasi)
    mockFindFirst.mockResolvedValue(snapshot({ variants: [] }) as any);
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
    }

    // Single-error (status transition)
    vi.resetAllMocks();
    mockFindFirst.mockResolvedValue(snapshot({ status: "ACTIVE" }) as any);
    try {
      await publishProductService(PRODUCT_ID, ADMIN_ID);
      expect.fail("harus throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
    }
  });

  // ── Case 22: Tidak ada write saat validasi gagal (side-effect free) ─
  it("validasi gagal → tidak ada write sama sekali (side-effect free)", async () => {
    mockFindFirst.mockResolvedValue(snapshot({ variants: [] }) as any);

    await expect(
      publishProductService(PRODUCT_ID, ADMIN_ID),
    ).rejects.toBeInstanceOf(AppError);

    // Tidak ada query selain read snapshot.
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });
});
