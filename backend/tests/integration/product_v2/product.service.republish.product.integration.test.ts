// tests/integration-test/product_v2/product.republish.integration.test.ts
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
 * Integration test untuk `POST /api/v1/admin/products_v2/:id/republish`.
 *
 * Cakupan:
 *  - Transisi INACTIVE → ACTIVE (happy path), validasi BR-07 sama
 *    dengan publish.
 *  - Multi-error BR-07 dalam format existing project (`data: [...]`).
 *  - Entry status harus INACTIVE — DRAFT & ACTIVE ditolak.
 *  - Not-found & soft-deleted → 404.
 *  - Race concurrent republish: satu 200, satu 400.
 *  - Race varian dihapus di antara read & write → disambiguasi.
 *  - Security: updated_by dari session.
 *  - Cross-endpoint: unpublish → republish (lifecycle penuh).
 *  - Params UUID, auth 401.
 *
 * Format error (Opsi B):
 *  - `{ status: "error", code, message }` untuk single-error.
 *  - `{ status: "error", code: "VALIDATION_ERROR", message, data: [...] }`
 *    untuk multi-error BR-07.
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
 * `status` default INACTIVE karena republish butuh entry INACTIVE.
 */
async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      name: opts.name,
      status: opts.status ?? "INACTIVE",
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
 * Ambil daftar `code` dari multi-error (`data` array — format project).
 */
function multiErrorCodes(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data.map((e: { code: string }) => e.code);
}

// ── Test suite ─────────────────────────────────────────────────────

describe("POST /api/v1/admin/products_v2/:id/republish", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    await prisma.category.create({
      data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ── Case 1: Happy path INACTIVE → ACTIVE ────────────────────
  it("200 — INACTIVE berhasil republish, status & updated_by tersimpan", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 20 }],
      images: [{ url: "https://img/kaos.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product republished successfully");
    expect(res.body.data).toEqual({ id: product.id, status: "ACTIVE" });

    // Persistensi.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("ACTIVE");
    expect(stored!.updatedBy).toBe(user.id);
  });

  // ── Case 2: Multi-error — 4 failure sekaligus ───────────────
  it("400 — multi-error: no variant + no image + no category (4 codes)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kosong",
      status: "INACTIVE",
      categoryId: null,
      createdBy: user.id,
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toBe("Product cannot be published");
    expect(Array.isArray(res.body.data)).toBe(true);

    // Order stabil: variant → image → primary image → category.
    expect(multiErrorCodes(res.body.data)).toEqual([
      "PRODUCT_NEEDS_VARIANT",
      "PRODUCT_NEEDS_IMAGE",
      "PRODUCT_NEEDS_PRIMARY_IMAGE",
      "CATEGORY_REQUIRED",
    ]);

    // Tidak ada write — tetap INACTIVE.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
  });

  // ── Case 3: Single validation failure ───────────────────────
  it("400 — hanya tanpa varian: multi-error format dengan 1 code", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      images: [{ url: "https://img/kaos.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toEqual(["PRODUCT_NEEDS_VARIANT"]);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 4: Tanpa gambar → 2 code (EC-PM-B3) ────────────────
  it("400 — tanpa gambar: NEEDS_IMAGE + NEEDS_PRIMARY_IMAGE", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toEqual([
      "PRODUCT_NEEDS_IMAGE",
      "PRODUCT_NEEDS_PRIMARY_IMAGE",
    ]);
  });

  // ── Case 5: Varian soft-deleted tidak dihitung (BR-14) ──────
  it("400 — semua varian soft-deleted: PRODUCT_NEEDS_VARIANT (BR-14)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [
        { sku: "A", price: 100000, stock: 10, deletedAt: new Date() },
        { sku: "B", price: 100000, stock: 5, deletedAt: new Date() },
      ],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toEqual(["PRODUCT_NEEDS_VARIANT"]);
  });

  // ── Case 6: Kategori null ───────────────────────────────────
  it("400 — kategori null: CATEGORY_REQUIRED", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      categoryId: null,
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toEqual(["CATEGORY_REQUIRED"]);
  });

  // ── Case 7: INVALID_PRICE (via spy — CHECK constraint DB) ───
  it("400 — INVALID_PRICE: validasi harga 0 (via spy; DB CHECK price>0 mencegah seed)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    // Snapshot awal dipaksa punya harga 0 → BR-07 gagal di validasi.
    vi.spyOn(prisma.product, "findFirst").mockResolvedValueOnce({
      id: product.id,
      status: "INACTIVE",
      categoryId: CATEGORY_ID,
      variants: [{ id: "v1", price: 0 }],
      images: [{ id: "i1", isPrimary: true }],
    } as any);

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toContain("INVALID_PRICE");

    // Tidak ada write.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
  });

  // ── Case 8: DRAFT → INVALID_STATUS_TRANSITION ───────────────
  it("400 — produk DRAFT: INVALID_STATUS_TRANSITION (republish khusus INACTIVE)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "DRAFT",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
    expect(res.body.message).toMatch(/DRAFT/);
    expect(res.body.message).toMatch(/ACTIVE/);
  });

  // ── Case 9: ACTIVE → INVALID_STATUS_TRANSITION ──────────────
  it("400 — produk ACTIVE: INVALID_STATUS_TRANSITION (sudah tayang)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "ACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  // ── Case 10: Not found ──────────────────────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk tidak ada", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(`${baseEndpoint}/11111111-1111-4111-8111-999999999999/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 11: Soft-deleted ───────────────────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk soft-deleted (BR-05)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Arsip",
      status: "INACTIVE",
      createdBy: user.id,
      deletedAt: new Date(),
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 12: Params bukan UUID ──────────────────────────────
  it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(`${baseEndpoint}/not-a-uuid/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 13: Tanpa auth ─────────────────────────────────────
  it("401 — UNAUTHORIZED tanpa auth", async () => {
    const res = await request(app).post(
      `${baseEndpoint}/11111111-1111-4111-8111-111111111111/republish`,
    );

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  // ── Case 14: Race concurrent republish ──────────────────────
  it("race — concurrent republish: satu 200, satu 400 INVALID_STATUS_TRANSITION", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`${baseEndpoint}/${product.id}/republish`)
        .set("Cookie", [accessTokenCookie]),
      request(app)
        .post(`${baseEndpoint}/${product.id}/republish`)
        .set("Cookie", [accessTokenCookie]),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);

    // Final state: ACTIVE (satu kali transisi).
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("ACTIVE");
  });

  // ── Case 15: Race — varian dihapus antara read & write ──────
  it("race — varian dihapus di antara read & write: affected=0, re-read → multi-error akurat", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    // Snapshot awal valid (spy), lalu varian dihapus sebelum executeRaw.
    vi.spyOn(prisma.product, "findFirst").mockResolvedValueOnce({
      id: product.id,
      status: "INACTIVE",
      categoryId: CATEGORY_ID,
      variants: [{ id: "v1", price: 100000 }],
      images: [{ id: "i1", isPrimary: true }],
    } as any);

    await prisma.productVariant.deleteMany({
      where: { productId: product.id },
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(multiErrorCodes(res.body.data)).toContain("PRODUCT_NEEDS_VARIANT");

    // Tidak ada write.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
  });

  // ── Case 16: Security — updated_by dari session ─────────────
  it("200 — updated_by dari session, payload spoofing diabaikan", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie])
      .send({ updated_by: "attacker-id", adminId: "attacker-id" });

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.updatedBy).toBe(user.id);
    expect(stored!.updatedBy).not.toBe("attacker-id");
  });

  // ── Case 17: Cross-endpoint unpublish → republish ───────────
  it("integrasi — lifecycle penuh: publish → unpublish → republish (DRAFT→ACTIVE→INACTIVE→ACTIVE)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();

    // Seed DRAFT lengkap syarat BR-07.
    const product = await prisma.product.create({
      data: {
        name: "Kaos",
        status: "DRAFT",
        categoryId: CATEGORY_ID,
        createdBy: user.id,
        updatedBy: user.id,
        variants: {
          create: [
            {
              sku: "CYCLE-L",
              price: 100000,
              stock: 10,
              size: "L",
              createdBy: user.id,
              updatedBy: user.id,
            },
          ],
        },
        images: {
          create: [
            {
              url: "https://img/cycle.png",
              fileKey: "key-cycle",
              isPrimary: true,
              createdBy: user.id,
            },
          ],
        },
      },
    });

    // 1) publish: DRAFT → ACTIVE
    const publishRes = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe("ACTIVE");

    // 2) unpublish: ACTIVE → INACTIVE
    const unpublishRes = await request(app)
      .post(`${baseEndpoint}/${product.id}/unpublish`)
      .set("Cookie", [accessTokenCookie]);
    expect(unpublishRes.status).toBe(200);
    expect(unpublishRes.body.data.status).toBe("INACTIVE");

    // 3) republish: INACTIVE → ACTIVE
    const republishRes = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);
    expect(republishRes.status).toBe(200);
    expect(republishRes.body.data.status).toBe("ACTIVE");

    // Final state konsisten.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("ACTIVE");
  });

  // ── Case 18: Cross-endpoint — publish tidak handle INACTIVE ─
  it("integrasi — publish endpoint menolak INACTIVE, harus pakai republish", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
      variants: [{ sku: "KAOS-L", price: 100000, stock: 10 }],
      images: [{ url: "https://img/a.png", isPrimary: true }],
    });

    // publish endpoint (DRAFT-only) menolak INACTIVE
    const publishRes = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);
    expect(publishRes.status).toBe(400);
    expect(publishRes.body.code).toBe("INVALID_STATUS_TRANSITION");

    // republish endpoint menerima INACTIVE
    const republishRes = await request(app)
      .post(`${baseEndpoint}/${product.id}/republish`)
      .set("Cookie", [accessTokenCookie]);
    expect(republishRes.status).toBe(200);
    expect(republishRes.body.data.status).toBe("ACTIVE");
  });
});
