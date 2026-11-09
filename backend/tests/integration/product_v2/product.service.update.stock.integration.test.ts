// tests/integration-test/product_v2/product.update-stock.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk
 * `PATCH /api/v1/admin/products_v2/:id/variants/:variantId/stock`.
 *
 * Cakupan:
 *  - Happy path: stock berubah, low_stock derived benar.
 *  - Boundary low_stock: stock=4 → true, stock=5 → false (BR-23).
 *  - Boundary BR-22: stock=0 valid, produk tetap ACTIVE (bukan auto-INACTIVE).
 *  - `stock < 0` → 400 INVALID_STOCK (BR-21, bukan VALIDATION_ERROR).
 *  - Zod validation: missing stock, string, float → 400 VALIDATION_ERROR.
 *  - Field terlarang (`.strict()`) → 400 VALIDATION_ERROR.
 *  - Product not-found / soft-deleted → 404 PRODUCT_NOT_FOUND.
 *  - Variant not-found / soft-deleted / milik product lain (IDOR)
 *    → 404 VARIANT_NOT_FOUND (anti-enumeration).
 *  - Params UUID, auth 401.
 *  - Race concurrent update → Last Write Wins (keduanya 200).
 *  - Cross-endpoint: update stock → GET list mencerminkan nilai baru.
 *  - Security: updated_by dari session, payload spoofing di-block.
 *
 * Format error (Opsi B): single-error `{ status: "error", code, message }`.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const baseEndpoint = "/api/v1/admin/products_v2";

// ── Seed helpers ───────────────────────────────────────────────────

interface SeedProductOpts {
  name?: string;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  deletedAt?: Date | null;
  createdBy: string;
}

async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      name: opts.name ?? "Kaos",
      status: opts.status ?? "DRAFT",
      categoryId: null,
      deletedAt: opts.deletedAt ?? null,
      createdBy: opts.createdBy,
      updatedBy: opts.createdBy,
    },
  });
}

interface SeedVariantOpts {
  productId: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  price?: number;
  stock?: number;
  deletedAt?: Date | null;
  createdBy: string;
}

/**
 * Seed variant. Default size = sku → kombinasi (size, color) unik
 * per produk (mencegah collision partial unique index saat seed
 * multiple variants).
 */
async function seedVariant(opts: SeedVariantOpts) {
  return prisma.productVariant.create({
    data: {
      productId: opts.productId,
      sku: opts.sku,
      size: opts.size === undefined ? opts.sku : opts.size,
      color: opts.color === undefined ? null : opts.color,
      price: opts.price ?? 100000,
      stock: opts.stock ?? 10,
      deletedAt: opts.deletedAt ?? null,
      createdBy: opts.createdBy,
      updatedBy: opts.createdBy,
    },
  });
}

// ── Test suite ─────────────────────────────────────────────────────

describe("PATCH /api/v1/admin/products_v2/:id/variants/:variantId/stock", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    await prisma.category.create({
      data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
    });
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 1 — Happy paths & boundaries
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths & boundaries", () => {
    it("200 — update stock, low_stock=false (stock >= 5)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        stock: 10,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 20 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Stock updated successfully");
      expect(res.body.data).toEqual({
        id: v.id,
        stock: 20,
        low_stock: false,
      });

      // Persistence.
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.stock).toBe(20);
      expect(stored!.updatedBy).toBe(user.id);
    });

    it("200 — boundary low_stock: stock=4 → true (BR-23)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 4 });

      expect(res.status).toBe(200);
      expect(res.body.data.low_stock).toBe(true);
    });

    it("200 — boundary low_stock: stock=5 → false (bukan low)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.low_stock).toBe(false);
    });

    it("200 — stock=0 valid (BR-22: produk ACTIVE dengan stok 0 tetap ACTIVE)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        stock: 10,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        id: v.id,
        stock: 0,
        low_stock: true,
      });

      // BR-22: produk TETAP ACTIVE — bukan auto-INACTIVE.
      const stored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stored!.status).toBe("ACTIVE");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Business rule: INVALID_STOCK (BR-21)
  // ═══════════════════════════════════════════════════════════════
  describe("business rule — INVALID_STOCK (BR-21)", () => {
    it("400 — INVALID_STOCK saat stock negatif (bukan VALIDATION_ERROR)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        stock: 10,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: -1 });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.code).toBe("INVALID_STOCK");

      // State tidak berubah (fast-fail sebelum sentuh DB).
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.stock).toBe(10);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Zod validation (struktur input)
  // ═══════════════════════════════════════════════════════════════
  describe("zod validation — struktur input", () => {
    it("400 — VALIDATION_ERROR saat stock tidak dikirim", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat stock bertipe string", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: "10" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat stock bukan integer (5.5)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 5.5 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat field terlarang (updated_by) dikirim (`.strict()`)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 10, updated_by: "attacker-id" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");

      // State tidak berubah.
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.updatedBy).toBe(user.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Not found (product / variant / IDOR)
  // ═══════════════════════════════════════════════════════════════
  describe("not found", () => {
    it("404 — PRODUCT_NOT_FOUND saat product tidak ada", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .patch(
          `${baseEndpoint}/11111111-1111-4111-8111-999999999999/variants/33333333-3333-4333-8333-333333333333/stock`,
        )
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 10 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("404 — PRODUCT_NOT_FOUND saat product soft-deleted (BR-05)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        createdBy: user.id,
        deletedAt: new Date(),
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        stock: 10,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 99 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");

      // Variant tidak tersentuh — bukan hanya tolak response,
      // benar-benar tidak ada write.
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.stock).toBe(10);
    });

    it("404 — VARIANT_NOT_FOUND saat variant tidak ada", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .patch(
          `${baseEndpoint}/${product.id}/variants/33333333-3333-4333-8333-999999999999/stock`,
        )
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 10 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");
    });

    it("404 — VARIANT_NOT_FOUND saat variant soft-deleted", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        stock: 10,
        deletedAt: new Date(),
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 99 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");

      // State tidak berubah — soft-deleted variant tetap punya stock lama.
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.stock).toBe(10);
    });

    it("404 — VARIANT_NOT_FOUND saat variant milik produk LAIN (IDOR) + variant tidak tersentuh", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const productA = await seedProduct({ name: "A", createdBy: user.id });
      const productB = await seedProduct({ name: "B", createdBy: user.id });

      // Variant milik product B.
      const vB = await seedVariant({
        productId: productB.id,
        sku: "B-VARIANT",
        stock: 10,
        createdBy: user.id,
      });

      // Request lewat product A → IDOR attempt.
      const res = await request(app)
        .patch(`${baseEndpoint}/${productA.id}/variants/${vB.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 999 });

      expect(res.status).toBe(404);
      // Anti-enumeration: tidak bisa dibedakan dari "variant tidak ada".
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");

      // Variant milik product B TIDAK tersentuh.
      const stored = await prisma.productVariant.findUnique({
        where: { id: vB.id },
      });
      expect(stored!.stock).toBe(10);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Validasi params & auth
  // ═══════════════════════════════════════════════════════════════
  describe("validasi params & auth", () => {
    it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .patch(
          `${baseEndpoint}/not-a-uuid/variants/33333333-3333-4333-8333-333333333333/stock`,
        )
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat :variantId bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .patch(
          `${baseEndpoint}/11111111-1111-4111-8111-111111111111/variants/not-a-uuid/stock`,
        )
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app)
        .patch(
          `${baseEndpoint}/11111111-1111-4111-8111-111111111111/variants/33333333-3333-4333-8333-333333333333/stock`,
        )
        .send({ stock: 10 });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Race conditions
  // ═══════════════════════════════════════════════════════════════
  describe("race conditions", () => {
    it("race — concurrent stock update: Last Write Wins (keduanya 200, final = salah satu nilai)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "RACE-STOCK",
        stock: 10,
        createdBy: user.id,
      });

      // Dua update concurrent ke nilai berbeda. Tidak ada invariant
      // yang dilanggar — stock adalah nilai bebas (BR-21 dijaga input).
      // Postgres row lock serialize writes; final state = yang terakhir commit.
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
          .set("Cookie", [accessTokenCookie])
          .send({ stock: 100 }),
        request(app)
          .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
          .set("Cookie", [accessTokenCookie])
          .send({ stock: 200 }),
      ]);

      // Keduanya sukses (Last Write Wins).
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Final state = salah satu nilai (bukan penjumlahan, bukan
      // state invalid).
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect([100, 200]).toContain(stored!.stock);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Cross-endpoint
  // ═══════════════════════════════════════════════════════════════
  describe("cross-endpoint", () => {
    it("update stock → GET list variant mencerminkan nilai baru", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "CROSS",
        stock: 10,
        createdBy: user.id,
      });

      await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 3 });

      const listRes = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items).toHaveLength(1);
      expect(listRes.body.data.items[0]).toMatchObject({
        id: v.id,
        stock: 3,
        low_stock: true,
      });
    });

    it("update stock → PUT variant tidak mengubah stock yang sudah di-update (partial update)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        stock: 10,
        createdBy: user.id,
      });

      // Update stock via endpoint stock.
      await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 7 });

      // Update SKU via PUT (tanpa menyentuh stock).
      await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "NEW-SKU" });

      // Stock tetap 7 (bukan reset ke 10).
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.sku).toBe("NEW-SKU");
      expect(stored!.stock).toBe(7);
    });
  });
});
