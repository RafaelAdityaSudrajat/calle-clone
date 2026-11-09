// src/modules/product/product.service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { createProductService } from "../../../src/modules/product_v2/product_v2.service";

// ── Mock Prisma client ──────────────────────────────────────────────
// Hanya dua method yang dipakai ProductService.create saat ini.
// Kalau nanti service memanggil method lain, tambahkan di sini.
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    category: { findUnique: vi.fn() },
    product: { create: vi.fn() },
  },
}));

// Import SETELAH mock dideklarasikan (hoisted oleh vitest).
import { prisma } from "../../../src/lib/prisma";
import { AppError } from "../../../src/lib/errors";

const mockCategoryFind = vi.mocked(prisma.category.findUnique);
const mockProductCreate = vi.mocked(prisma.product.create);

// ID fiktif — nilai tidak penting, asal bentuknya cocok dengan yang diharapkan.
const ADMIN_ID = "00000000-0000-0000-0000-00000000ad01";
const CATEGORY_ID = "00000000-0000-0000-0000-0000000c0001";

/**
 * Helper membuat `PrismaClientKnownRequestError` dengan kode P2003.
 * Dipakai untuk mensimulasikan pelanggaran foreign-key — mis. saat kategori
 * dihapus di antara pre-check dan insert (race condition).
 */

function makeP2003() {
  return new Prisma.PrismaClientKnownRequestError(
    "Foreign key constraint failed",
    {
      code: "P2003",
      clientVersion: "test",
    },
  );
}

describe("createProductService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── Case 1: Happy path ─────────────────────────────────────────
  it("membuat produk dengan status DRAFT saat kategori valid", async () => {
    const createdAt = new Date("2026-10-29T13:30:54.799Z");

    mockCategoryFind.mockResolvedValue({ id: CATEGORY_ID } as any);
    mockProductCreate.mockResolvedValue({
      id: "product-uuid",
      name: "Kaos Hitam Premium",
      description: "Katun combed 30s",
      categoryId: CATEGORY_ID,
      status: "DRAFT",
      createdBy: ADMIN_ID,
      createdAt,
    } as any);

    const result = await createProductService(
      {
        name: "Kaos Hitam Premium",
        description: "Katun combed 30s",
        category_id: CATEGORY_ID,
      },
      ADMIN_ID,
    );

    // Pre-check: select minimal, hanya id.
    expect(mockCategoryFind).toHaveBeenCalledWith({
      where: { id: CATEGORY_ID },
      select: { id: true },
    });

    // Insert: status DRAFT di-hardcode (bukan dari input), actor dari argumen.
    expect(mockProductCreate).toHaveBeenCalledWith({
      data: {
        name: "Kaos Hitam Premium",
        description: "Katun combed 30s",
        categoryId: CATEGORY_ID,
        status: "DRAFT",
        createdBy: ADMIN_ID,
        updatedBy: ADMIN_ID,
      },
      select: expect.any(Object),
    });

    // DTO: nama field snake_case + Date → ISO string.
    expect(result).toEqual({
      id: "product-uuid",
      name: "Kaos Hitam Premium",
      description: "Katun combed 30s",
      category_id: CATEGORY_ID,
      status: "DRAFT",
      created_by: ADMIN_ID,
      created_at: "2026-10-29T13:30:54.799Z",
    });
  });

  it("mengabaikan status dari input dan selalu menyimpan DRAFT", async () => {
    mockProductCreate.mockResolvedValue({
      id: "product-uuid",
      name: "Topi Baseball",
      description: null,
      categoryId: null,
      status: "DRAFT",
      createdBy: ADMIN_ID,
      createdAt: new Date("2026-10-29T13:30:54.799Z"),
    } as any);

    await createProductService(
      {
        name: "X",
        description: null,
        category_id: null,
        status: "ACTIVE",
      } as any,
      ADMIN_ID,
    );

    expect(mockProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      }),
    );
  });

  // ── Case 2: Tanpa kategori (DRAFT boleh) ──────────────────────
  it("membuat produk tanpa kategori tanpa memanggil findUnique", async () => {
    mockProductCreate.mockResolvedValue({
      id: "product-uuid",
      name: "Topi Baseball",
      description: null,
      categoryId: null,
      status: "DRAFT",
      createdBy: ADMIN_ID,
      createdAt: new Date("2026-10-29T13:30:54.799Z"),
    } as any);

    const result = await createProductService(
      { name: "Topi Baseball", description: null, category_id: null },
      ADMIN_ID,
    );

    expect(mockCategoryFind).not.toHaveBeenCalled();
    expect(mockProductCreate).toHaveBeenCalledTimes(1);
    expect(result.category_id).toBeNull();
    expect(result.status).toBe("DRAFT");
  });

  // ── Case 3: Kategori tidak ada (pre-check) ────────────────────
  it("melempar CATEGORY_NOT_FOUND saat pre-check gagal", async () => {
    mockCategoryFind.mockResolvedValue(null);

    await expect(
      createProductService(
        { name: "Kaos", description: null, category_id: CATEGORY_ID },
        ADMIN_ID,
      ),
    ).rejects.toMatchObject({
      code: "CATEGORY_NOT_FOUND",
      statusCode: 404,
    });

    // Insert tidak boleh dipanggil kalau pre-check sudah gagal.
    expect(mockProductCreate).not.toHaveBeenCalled();
  });

  // ── Case 4: Race condition — P2003 dengan FK kategori ─────────
  it("memetakan P2003 menjadi CATEGORY_NOT_FOUND saat kategori hilang di antara cek dan insert (race)", async () => {
    mockCategoryFind
      .mockResolvedValueOnce({ id: CATEGORY_ID } as any) // pre-check: ada
      .mockResolvedValueOnce(null); // re-check di catch: sudah hilang
    mockProductCreate.mockRejectedValue(makeP2003());

    await expect(
      createProductService(
        { name: "Kaos", description: null, category_id: CATEGORY_ID },
        ADMIN_ID,
      ),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND", statusCode: 404 });

    expect(mockCategoryFind).toHaveBeenCalledTimes(2);
  });

  // ── Case 5: P2003 non-kategori (mis. createdBy FK) ────────────
  it("meneruskan P2003 apa adanya saat kategori masih ada (mis. FK createdBy)", async () => {
    mockCategoryFind
      .mockResolvedValueOnce({ id: CATEGORY_ID } as any) // pre-check
      .mockResolvedValueOnce({ id: CATEGORY_ID } as any); // re-check: masih ada
    const original = makeP2003();
    mockProductCreate.mockRejectedValue(original);

    await expect(
      createProductService(
        { name: "Kaos", description: null, category_id: CATEGORY_ID },
        ADMIN_ID,
      ),
    ).rejects.toBe(original);
  });

  // ── Case 6: Error Prisma lain (bukan P2003) ───────────────────
  it("meneruskan error non-P2003 apa adanya", async () => {
    mockCategoryFind.mockResolvedValue({ id: CATEGORY_ID } as any);
    const original = new Error("connection lost");
    mockProductCreate.mockRejectedValue(original);

    await expect(
      createProductService(
        { name: "Kaos", description: null, category_id: CATEGORY_ID },
        ADMIN_ID,
      ),
    ).rejects.toBe(original);
  });

  // ── Case 7: Mapper — Date → string ISO ────────────────────────
  it("mapper mengonversi Date ke string ISO-8601 di field created_at", async () => {
    const createdAt = new Date("2026-01-15T08:00:00.000Z");
    mockProductCreate.mockResolvedValue({
      id: "p",
      name: "X",
      description: null,
      categoryId: null,
      status: "DRAFT",
      createdBy: ADMIN_ID,
      createdAt,
    } as any);

    const result = await createProductService(
      { name: "X", description: null, category_id: null },
      ADMIN_ID,
    );

    expect(typeof result.created_at).toBe("string");
    expect(result.created_at).toBe("2026-01-15T08:00:00.000Z");
  });

  // ── Case 8: Error type harus AppError ─────────────────────────
  it("melempar instance AppError sehingga global handler bisa mapping status", async () => {
    mockCategoryFind.mockResolvedValue(null);

    try {
      await createProductService(
        { name: "X", description: null, category_id: CATEGORY_ID },
        ADMIN_ID,
      );
      // Baris ini tidak boleh tercapai.
      expect.fail("seharusnya throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
    }
  });
});
