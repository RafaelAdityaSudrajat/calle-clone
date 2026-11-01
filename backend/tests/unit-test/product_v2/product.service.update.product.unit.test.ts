// src/modules/product/update-product.service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { updateProductService } from "../../../src/modules/product_v2/product_v2.service";

// ── Mock Prisma client ──────────────────────────────────────────────
// Method yang dipakai updateProductService:
//  - category.findUnique  → pre-check & re-check race P2003
//  - product.findFirst    → disambiguasi P2025 (hanya jalur clear category)
//  - product.update       → operasi utama (atomik)
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    category: { findUnique: vi.fn() },
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Import SETELAH mock dideklarasikan (hoisted oleh vitest).
import { prisma } from "../../../src/lib/prisma";
import { AppError } from "../../../src/lib/errors";

const mockCategoryFind = vi.mocked(prisma.category.findUnique);
const mockProductFindFirst = vi.mocked(prisma.product.findFirst);
const mockProductUpdate = vi.mocked(prisma.product.update);

// ID fiktif — nilai tidak penting, asal bentuknya cocok dengan yang diharapkan.
const ADMIN_ID = "00000000-0000-0000-0000-00000000ad01";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

/**
 * Helper membuat `PrismaClientKnownRequestError` dengan kode P2003.
 * Dipakai untuk mensimulasikan pelanggaran foreign-key — mis. saat kategori
 * dihapus di antara pre-check dan update (race condition).
 */
function makeP2003(fieldName: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Foreign key constraint failed",
    {
      code: "P2003",
      clientVersion: "test",
      meta: { field_name: fieldName },
    },
  );
}

/**
 * Helper membuat `PrismaClientKnownRequestError` dengan kode P2025.
 * Prisma melempar P2025 saat `update` tidak menemukan baris yang cocok
 * dengan `where` (id tidak ada / soft-deleted / status filter tidak match).
 */
function makeP2025(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Record to update not found",
    {
      code: "P2025",
      clientVersion: "test",
      meta: { modelName: "Product" },
    },
  );
}

/**
 * Row yang dikembalikan `product.update` pada happy path.
 * Field lengkap sesuai `select` di service; mapper hanya mengambil
 * subset DTO (id, name, updatedBy, updatedAt).
 */
function updatedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    name: "Nama Baru",
    description: null,
    categoryId: null,
    status: "DRAFT" as const,
    updatedBy: ADMIN_ID,
    updatedAt: new Date("2026-10-27T11:00:00.000Z"),
    ...overrides,
  };
}

describe("updateProductService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── Case 1: Happy path — update name saja ─────────────────────
  it("update name saja — sukses, where tanpa status filter, findFirst tidak dipanggil", async () => {
    mockProductUpdate.mockResolvedValue(
      updatedRow({ name: "Nama Baru" }) as any,
    );

    const result = await updateProductService(
      PRODUCT_ID,
      { name: "Nama Baru" },
      ADMIN_ID,
    );

    // Update atomik: where hanya { id, deletedAt: null } — tidak ada
    // filter status karena name update tidak menyentuh kategori.
    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID, deletedAt: null },
      data: { updatedBy: ADMIN_ID, name: "Nama Baru" },
      select: expect.any(Object),
    });

    // DTO: snake_case + Date → ISO.
    expect(result).toEqual({
      id: PRODUCT_ID,
      name: "Nama Baru",
      category_id: null,
      description: null,
      status: "DRAFT",
      updated_by: ADMIN_ID,
      updated_at: "2026-10-27T11:00:00.000Z",
    });

    // Jalur name saja tidak butuh query tambahan.
    expect(mockCategoryFind).not.toHaveBeenCalled();
    expect(mockProductFindFirst).not.toHaveBeenCalled();
  });

  // ── Case 2: Happy path — description non-empty ────────────────
  it("update description non-empty — diteruskan apa adanya", async () => {
    mockProductUpdate.mockResolvedValue(updatedRow() as any);

    await updateProductService(
      PRODUCT_ID,
      { description: "deskripsi baru" },
      ADMIN_ID,
    );

    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { updatedBy: ADMIN_ID, description: "deskripsi baru" },
      }),
    );
  });

  // ── Case 3: Normalisasi description "" → null ────────────────
  it("update description string kosong dinormalisasi menjadi null", async () => {
    mockProductUpdate.mockResolvedValue(updatedRow() as any);

    await updateProductService(PRODUCT_ID, { description: "" }, ADMIN_ID);

    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: null }),
      }),
    );
  });

  // ── Case 4: Happy path — set kategori (UUID valid, exists) ───
  it("update category_id valid — pre-check dipanggil, findFirst tidak dipanggil", async () => {
    mockCategoryFind.mockResolvedValue({ id: CATEGORY_ID } as any);
    mockProductUpdate.mockResolvedValue(
      updatedRow({ categoryId: CATEGORY_ID }) as any,
    );

    await updateProductService(
      PRODUCT_ID,
      { category_id: CATEGORY_ID },
      ADMIN_ID,
    );

    // Pre-check: select minimal, hanya id.
    expect(mockCategoryFind).toHaveBeenCalledWith({
      where: { id: CATEGORY_ID },
      select: { id: true },
    });

    // Set kategori (bukan clear) → tidak butuh filter status di where.
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PRODUCT_ID, deletedAt: null },
        data: expect.objectContaining({ categoryId: CATEGORY_ID }),
      }),
    );

    expect(mockProductFindFirst).not.toHaveBeenCalled();
  });

  // ── Case 5: Multi-field update ────────────────────────────────
  it("update multi-field — semua field masuk data", async () => {
    mockCategoryFind.mockResolvedValue({ id: CATEGORY_ID } as any);
    mockProductUpdate.mockResolvedValue(updatedRow() as any);

    await updateProductService(
      PRODUCT_ID,
      { name: "Baru", description: "D", category_id: CATEGORY_ID },
      ADMIN_ID,
    );

    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          updatedBy: ADMIN_ID,
          name: "Baru",
          description: "D",
          categoryId: CATEGORY_ID,
        },
      }),
    );
  });

  // ── Case 6: Body kosong → VALIDATION_ERROR ────────────────────
  it("body kosong ditolak VALIDATION_ERROR tanpa menyentuh DB", async () => {
    await expect(
      updateProductService(PRODUCT_ID, {}, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });

    expect(mockCategoryFind).not.toHaveBeenCalled();
    expect(mockProductFindFirst).not.toHaveBeenCalled();
    expect(mockProductUpdate).not.toHaveBeenCalled();
  });

  // ── Case 7: Error type harus AppError ─────────────────────────
  it("body kosong melempar instance AppError", async () => {
    try {
      await updateProductService(PRODUCT_ID, {}, ADMIN_ID);
      expect.fail("seharusnya throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
    }
  });

  // ── Case 8: Race-safe — clear category via where.status ───────
  it("clear kategori memakai where { status: { not: 'ACTIVE' } } — atomik, tanpa findFirst", async () => {
    mockProductUpdate.mockResolvedValue(updatedRow() as any);

    await updateProductService(PRODUCT_ID, { category_id: null }, ADMIN_ID);

    // PENTING: filter status != ACTIVE didorong ke WHERE update → atomik.
    // Tidak ada window di mana publish concurrent bisa menyelipkan
    // status=ACTIVE di antara findFirst dan update.
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: PRODUCT_ID,
          deletedAt: null,
          status: { not: "ACTIVE" },
        },
        data: expect.objectContaining({ categoryId: null }),
      }),
    );

    // Happy path clear category: 1 query DB saja.
    expect(mockProductFindFirst).not.toHaveBeenCalled();
    expect(mockCategoryFind).not.toHaveBeenCalled();
  });

  // ── Case 9: Race — P2025 + findFirst ACTIVE → CATEGORY_REQUIRED
  it("P2025 saat clear category + produk ACTIVE — disambiguasi ke CATEGORY_REQUIRED (race)", async () => {
    // Skenario: DRAFT saat request dikirim, tapi publish concurrent
    // commit lebih dulu → update dengan status!=ACTIVE gagal P2025.
    mockProductUpdate.mockRejectedValue(makeP2025());
    mockProductFindFirst.mockResolvedValue({ status: "ACTIVE" } as any);

    await expect(
      updateProductService(PRODUCT_ID, { category_id: null }, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "CATEGORY_REQUIRED",
      statusCode: 400,
    });

    // Disambiguasi: findFirst dipanggil SETELAH update P2025.
    expect(mockProductFindFirst).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID, deletedAt: null },
      select: { status: true },
    });
  });

  // ── Case 10: P2025 + findFirst null → PRODUCT_NOT_FOUND ───────
  it("P2025 saat clear category + produk tidak ada / soft-deleted — PRODUCT_NOT_FOUND", async () => {
    mockProductUpdate.mockRejectedValue(makeP2025());
    mockProductFindFirst.mockResolvedValue(null);

    await expect(
      updateProductService(PRODUCT_ID, { category_id: null }, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404,
    });

    expect(mockProductFindFirst).toHaveBeenCalledTimes(1);
  });

  // ── Case 11: P2025 tanpa filter status → langsung 404 ─────────
  it("P2025 pada update name (tanpa filter status) — PRODUCT_NOT_FOUND, tanpa disambiguasi", async () => {
    mockProductUpdate.mockRejectedValue(makeP2025());

    await expect(
      updateProductService(PRODUCT_ID, { name: "X" }, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404,
    });

    // Tanpa status filter di where, P2025 = not-found / soft-deleted.
    // Tidak perlu disambiguasi → findFirst tidak dipanggil.
    expect(mockProductFindFirst).not.toHaveBeenCalled();
  });

  // ── Case 12: Pre-check kategori gagal ────────────────────────
  it("kategori tidak ada saat pre-check — CATEGORY_NOT_FOUND tanpa update", async () => {
    mockCategoryFind.mockResolvedValue(null);

    await expect(
      updateProductService(PRODUCT_ID, { category_id: CATEGORY_ID }, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "CATEGORY_NOT_FOUND",
      statusCode: 404,
    });

    expect(mockProductUpdate).not.toHaveBeenCalled();
  });

  // ── Case 13: Race — P2003 + re-check hilang ──────────────────
  it("P2003 FK kategori setelah pre-check lolos — re-check hilang → CATEGORY_NOT_FOUND (race)", async () => {
    // Pre-check lolos, tapi re-check di catch → null (kategori sudah dihapus).
    mockCategoryFind
      .mockResolvedValueOnce({ id: CATEGORY_ID } as any)
      .mockResolvedValueOnce(null);

    mockProductUpdate.mockRejectedValue(makeP2003("categoryId"));

    await expect(
      updateProductService(PRODUCT_ID, { category_id: CATEGORY_ID }, ADMIN_ID),
    ).rejects.toMatchObject({
      code: "CATEGORY_NOT_FOUND",
      statusCode: 404,
    });

    // Dua kali: pre-check + re-check di catch.
    expect(mockCategoryFind).toHaveBeenCalledTimes(2);
  });

  // ── Case 14: P2003 + re-check exists → re-throw ──────────────
  it("P2003 dengan kategori masih ada (FK lain) — error diteruskan apa adanya", async () => {
    mockCategoryFind
      .mockResolvedValueOnce({ id: CATEGORY_ID } as any)
      .mockResolvedValueOnce({ id: CATEGORY_ID } as any);

    const original = makeP2003("categoryId");
    mockProductUpdate.mockRejectedValue(original);

    // Bukan FK kategori → biarkan bubble ke global handler.
    await expect(
      updateProductService(PRODUCT_ID, { category_id: CATEGORY_ID }, ADMIN_ID),
    ).rejects.toBe(original);
  });

  // ── Case 15: P2003 dengan category_id null → tanpa re-check ──
  it("P2003 saat category_id null — tidak re-check kategori, error diteruskan", async () => {
    const original = makeP2003("updatedBy");
    mockProductUpdate.mockRejectedValue(original);

    await expect(
      updateProductService(PRODUCT_ID, { category_id: null }, ADMIN_ID),
    ).rejects.toBe(original);

    // Re-check kategori hanya dijalankan kalau category_id string.
    expect(mockCategoryFind).not.toHaveBeenCalled();
  });

  // ── Case 16: Error Prisma lain (bukan P2025 / P2003) ─────────
  it("meneruskan error non-P2025/P2003 apa adanya", async () => {
    const original = new Error("connection lost");
    mockProductUpdate.mockRejectedValue(original);

    await expect(
      updateProductService(PRODUCT_ID, { name: "X" }, ADMIN_ID),
    ).rejects.toBe(original);
  });

  // ── Case 17: Keamanan — updatedBy selalu dari adminId ────────
  it("updatedBy diambil dari adminId — payload client diabaikan (security)", async () => {
    mockProductUpdate.mockResolvedValue(updatedRow() as any);

    // Schema .strict() sudah menolak `updated_by` di body sebelum
    // sampai service. Test ini membuktikan service juga tidak
    // mempercayai input — kalau lapis schema jebol, actor tetap
    // dari session.
    const malicious = { name: "X", updated_by: "attacker-id" } as any;

    await updateProductService(PRODUCT_ID, malicious, ADMIN_ID);

    const callData = mockProductUpdate.mock.calls[0][0].data as any;
    expect(callData.updatedBy).toBe(ADMIN_ID);
    expect(callData.updatedBy).not.toBe("attacker-id");
  });

  // ── Case 18: BR-05 — deletedAt: null selalu ada di where ─────
  it("where selalu menyertakan deletedAt: null (soft-delete-safe, BR-05)", async () => {
    mockProductUpdate.mockResolvedValue(updatedRow() as any);

    await updateProductService(PRODUCT_ID, { name: "X" }, ADMIN_ID);

    const callWhere = mockProductUpdate.mock.calls[0][0].where as any;
    expect(callWhere).toMatchObject({ id: PRODUCT_ID, deletedAt: null });
  });

  // ── Case 19: Status tidak pernah masuk data ──────────────────
  it("status TIDAK pernah masuk `data` — tidak bisa diubah via PUT", async () => {
    mockProductUpdate.mockResolvedValue(updatedRow() as any);

    await updateProductService(
      PRODUCT_ID,
      { name: "X", description: "D", category_id: null },
      ADMIN_ID,
    );

    const callData = mockProductUpdate.mock.calls[0][0].data as any;
    expect(callData).not.toHaveProperty("status");
  });

  // ── Case 20: Mapper — Date → string ISO ──────────────────────
  it("mapper mengonversi Date ke string ISO-8601 di field updated_at", async () => {
    const updatedAt = new Date("2026-01-15T08:00:00.000Z");
    mockProductUpdate.mockResolvedValue(updatedRow({ updatedAt }) as any);

    const result = await updateProductService(
      PRODUCT_ID,
      { name: "X" },
      ADMIN_ID,
    );

    expect(typeof result.updated_at).toBe("string");
    expect(result.updated_at).toBe("2026-01-15T08:00:00.000Z");
  });
});
