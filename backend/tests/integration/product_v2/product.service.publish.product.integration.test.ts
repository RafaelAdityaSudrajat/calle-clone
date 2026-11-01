// tests/integration-test/product_v2/product.publish.integration.test.ts
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk `POST /api/v1/admin/products_v2/:id/publish`.
 *
 * Cakupan (bukan logika bisnis murni — itu wilayah unit test):
 *  - Route POST :id/publish terdaftar & middleware terpasang (auth + params).
 *  - BR-07/BR-08: multi-error envelope (`data.errors[]`) berisi SEMUA
 *    kegagalan sekaligus — bukan throw-first.
 *  - Transisi DRAFT → ACTIVE atomik, status & updated_by tersimpan di DB.
 *  - Status non-DRAFT → 400 INVALID_STATUS_TRANSITION (single-error format).
 *  - Soft-deleted / not-found → 404 PRODUCT_NOT_FOUND.
 *  - Race concurrent publish: satu 200, satu 400.
 *  - Race varian dihapus di antara read & write: re-read → multi-error akurat.
 *  - Varian soft-deleted tidak dihitung (BR-14).
 *  - Security: updated_by diambil dari session, bukan payload.
 *  - Params bukan UUID → 400; tanpa auth → 401.
 *
 * Catatan format error:
 *  - Kegagalan validasi BR-07 → multi-error: `res.body.data.errors[]`.
 *  - Kegagalan status / not-found / validasi params / auth →
 *    single-error: `res.body.code`.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const baseEndpoint = "/api/v1/admin/products_v2";

// ── Seed helper ────────────────────────────────────────────────────

interface SeedProductOpts {
  name: string;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  categoryId?: string | null;
  deletedAt?: Date | null;
  createdBy: string;
  variants?: Array<{
    sku: string;
    price: number;
    stock: number;
    size?: string | null;
    color?: string | null;
    deletedAt?: Date | null;
  }>;
  images?: Array<{ url: string; isPrimary: boolean }>;
}

/**
 * Seed satu produk + nested variants & images.
 *
 * Catatan:
 *  - `size: "L"` default: CHECK constraint DB mensyaratkan minimal
 *    salah satu dari size/color terisi (BR-11).
 *  - `fileKey` NOT NULL → di-generate dari url.
 *  - `categoryId` default CATEGORY_ID — override ke `null` untuk test
 *    CATEGORY_REQUIRED.
 */
async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      name: opts.name,
      status: opts.status ?? "DRAFT",
      categoryId: opts.categoryId === undefined ? CATEGORY_ID : opts.categoryId,
      deletedAt: opts.deletedAt ?? null,
      createdBy: opts.createdBy,
      updatedBy: opts.createdBy,
      variants: opts.variants?.length
        ? {
            create: opts.variants.map((v) => ({
              sku: v.sku,
              price: v.price,
              stock: v.stock,
              size: v.size ?? "L",
              color: v.color ?? null,
              deletedAt: v.deletedAt ?? null,
              createdBy: opts.createdBy,
              updatedBy: opts.createdBy,
            })),
          }
        : undefined,
      images: opts.images?.length
        ? {
            create: opts.images.map((i) => ({
              url: i.url,
              fileKey: `key-${i.url}`,
              isPrimary: i.isPrimary,
              createdBy: opts.createdBy,
            })),
          }
        : undefined,
    },
  });
}

/**
 * Ambil daftar `code` dari multi-error envelope (`data.errors[]`).
 * Mengembalikan [] kalau format-nya single-error (mis. NOT_FOUND /
 * STATUS_TRANSITION) — memudahkan assertion tanpa crash.
 */
/**
 * Ambil daftar `code` dari error validasi multi-failure.
 *
 * Project ini mengembalikan `data` sebagai ARRAY langsung:
 *   { status: "error", code: "VALIDATION_ERROR", data: [{ code, message }, ...] }
 *
 * Helper juga mendukung format PRD (`data.errors: [...]`) agar test
 * tidak perlu diubah kalau suatu saat error handler diseragamkan.
 *
 * Terima `data` (bukan body penuh) supaya pemanggil fleksibel:
 *   - multiErrorCodes(res.body.data)  ← format existing
 *   - multiErrorCodes(res.body)       ← kalau helper lain mau pass body
 *     (didukung via fallback di bawah)
 */
function multiErrorCodes(input: unknown): string[] {
  // Format existing: `data` adalah array of errors
  if (Array.isArray(input)) {
    return input.map((e: { code: string }) => e.code);
  }
  // Fallback: input adalah body penuh dengan `.data` array
  if (input && typeof input === "object") {
    const obj = input as {
      data?: Array<{ code: string }> | { errors?: Array<{ code: string }> };
    };
    if (Array.isArray(obj.data)) {
      return obj.data.map((e) => e.code);
    }
    // Format PRD (untuk forward-compat): `data.errors` array
    const errs = (obj.data as { errors?: Array<{ code: string }> })?.errors;
    if (Array.isArray(errs)) return errs.map((e) => e.code);
  }
  return [];
}

// ── Test suite ─────────────────────────────────────────────────────

describe("POST /api/v1/admin/products_v2/:id/publish", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    await prisma.category.create({
      data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
    });
  });

  afterEach(() => {
    // Restore spyOn yang dipakai di test race.
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ── Case 1: Happy path ──────────────────────────────────────
  it("200 — publish DRAFT yang memenuhi semua syarat BR-07", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos Hitam",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 20 }],
      images: [{ url: "https://img/kaos.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product published successfully");
    expect(res.body.data).toEqual({ id: product.id, status: "ACTIVE" });

    // Persistensi: status & updated_by benar-benar berubah.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("ACTIVE");
    expect(stored!.updatedBy).toBe(user.id);
  });

  // ── Case 2: Multi-error — 4 failure sekaligus (EC-PM-B6) ───
  it("400 — multi-error: no variant + no image + no category (4 codes, order stabil)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kosong",
      categoryId: null,
      createdBy: user.id,
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    // Error response pakai `status: "error"` + `data: [...]` langsung.
    expect(res.body.status).toBe("error");
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toBe("Product cannot be published");
    expect(Array.isArray(res.body.data)).toBe(true);

    // Urutan stabil: variant → image → primary image → category.
    expect(multiErrorCodes(res.body.data)).toEqual([
      "PRODUCT_NEEDS_VARIANT",
      "PRODUCT_NEEDS_IMAGE",
      "PRODUCT_NEEDS_PRIMARY_IMAGE",
      "CATEGORY_REQUIRED",
    ]);

    // Tidak ada write.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("DRAFT");
  });

  // ── Case 3: Single validation failure → tetap multi-error format
  it("400 — hanya tanpa varian: multi-error format (bukan single code)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      // varian kosong, gambar & kategori OK
      images: [{ url: "https://img/kaos.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);

    // Format existing: status "error" + top-level code + data array.
    expect(res.body.status).toBe("error");
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(multiErrorCodes(res.body.data)).toEqual(["PRODUCT_NEEDS_VARIANT"]);
  });

  // ── Case 4: Tanpa gambar — 2 kode (EC-PM-B3) ────────────────
  it("400 — tanpa gambar: NEEDS_IMAGE + NEEDS_PRIMARY_IMAGE sekaligus", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toEqual([
      "PRODUCT_NEEDS_IMAGE",
      "PRODUCT_NEEDS_PRIMARY_IMAGE",
    ]);
  });

  // ── Case 5: Gambar ada, tidak ada primary (edge) ────────────
  it("400 — gambar ada tapi tanpa primary: hanya NEEDS_PRIMARY_IMAGE", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [
        { url: "https://img/a.png", isPrimary: false },
        { url: "https://img/b.png", isPrimary: false },
      ],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toEqual([
      "PRODUCT_NEEDS_PRIMARY_IMAGE",
    ]);
  });

  // ── Case 6: Varian hanya soft-deleted → dianggap tidak ada ──
  it("400 — semua varian soft-deleted: dihitung sebagai PRODUCT_NEEDS_VARIANT (BR-14)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [
        { sku: "A", price: 100000, stock: 10, deletedAt: new Date() },
        { sku: "B", price: 100000, stock: 5, deletedAt: new Date() },
      ],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toEqual(["PRODUCT_NEEDS_VARIANT"]);
  });

  // ── Case 7: Kategori null ───────────────────────────────────
  it("400 — kategori null: hanya CATEGORY_REQUIRED", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      categoryId: null,
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toEqual(["CATEGORY_REQUIRED"]);
  });

  // ── Case 8: INVALID_PRICE via spy (CHECK constraint DB) ─────
  it("400 — INVALID_PRICE: validasi harga 0 (via spy; DB CHECK price>0 mencegah seed langsung)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    // CHECK constraint "ProductVariant_price_positive_check" mencegah
    // seed varian harga 0 lewat Prisma. Spy panggilan pertama findFirst
    // agar validation melihat snapshot dengan harga 0. Validation
    // berjalan sebelum write → spy cukup sekali.
    vi.spyOn(prisma.product, "findFirst").mockResolvedValueOnce({
      id: product.id,
      status: "DRAFT",
      categoryId: CATEGORY_ID,
      variants: [{ id: "v1", price: 0 }],
      images: [{ id: "i1", isPrimary: true }],
    } as any);

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toContain("INVALID_PRICE");

    // Tidak ada write — status tetap DRAFT di DB.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("DRAFT");
  });

  // ── Case 9: Status ACTIVE → INVALID_STATUS_TRANSITION ───────
  it("400 — produk ACTIVE: INVALID_STATUS_TRANSITION (single-error format)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "ACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    // Single-error: `code` di top-level (bukan validasi BR-07).
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
    expect(res.body.data).toBeUndefined();
  });

  // ── Case 10: Status INACTIVE → INVALID_STATUS_TRANSITION ────
  it("400 — produk INACTIVE: INVALID_STATUS_TRANSITION (publish DRAFT-only, republish lewat endpoint lain)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  // ── Case 11: Not found ──────────────────────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk tidak ada", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(`${baseEndpoint}/11111111-1111-4111-8111-999999999999/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 12: Soft-deleted product ───────────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk soft-deleted (BR-05)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Arsip",
      createdBy: user.id,
      deletedAt: new Date(),
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 13: Params bukan UUID ──────────────────────────────
  it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(`${baseEndpoint}/not-a-uuid/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 14: Tanpa auth ─────────────────────────────────────
  it("401 — UNAUTHORIZED tanpa auth", async () => {
    const res = await request(app).post(
      `${baseEndpoint}/11111111-1111-4111-8111-111111111111/publish`,
    );

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  // ── Case 15: Race — concurrent publish ──────────────────────
  it("race — concurrent publish: satu 200, satu 400 INVALID_STATUS_TRANSITION", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`${baseEndpoint}/${product.id}/publish`)
        .set("Cookie", [accessTokenCookie]),
      request(app)
        .post(`${baseEndpoint}/${product.id}/publish`)
        .set("Cookie", [accessTokenCookie]),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);

    // Final state: ACTIVE (satu kali transisi, bukan dua).
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("ACTIVE");
  });

  // ── Case 16: Race — varian dihapus antara read & write ──────
  it("race — varian dihapus di antara read & write: affected=0, re-read → multi-error akurat (PRODUCT_NEEDS_VARIANT)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    // Spy panggilan pertama findFirst → snapshot valid (semua syarat lolos).
    // Panggilan berikutnya (re-read di catch affected=0) → real DB.
    vi.spyOn(prisma.product, "findFirst").mockResolvedValueOnce({
      id: product.id,
      status: "DRAFT",
      categoryId: CATEGORY_ID,
      variants: [{ id: "v1", price: 100000 }],
      images: [{ id: "i1", isPrimary: true }],
    } as any);

    // Hapus varian SEBELUM request → executeRaw WHERE EXISTS gagal
    // (affected=0) → service re-read → varian benar-benar tidak ada
    // → multi-error PRODUCT_NEEDS_VARIANT (state saat ini, bukan
    // snapshot basi).
    await prisma.productVariant.deleteMany({
      where: { productId: product.id },
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toContain("PRODUCT_NEEDS_VARIANT");

    // Tidak ada write — status tetap DRAFT.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("DRAFT");
  });

  // ── Case 17: Security — updated_by dari session ─────────────
  it("200 — updated_by disimpan dari session user, bukan dari request", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    // Kirim body palsu — publish tidak punya body schema, jadi
    // body diabaikan oleh route. Verifikasi tetap kuat lewat DB:
    // updated_by = user.id dari session.
    await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie])
      .send({ updated_by: "attacker-id", adminId: "attacker-id" });

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.updatedBy).toBe(user.id);
    expect(stored!.updatedBy).not.toBe("attacker-id");
  });
});
