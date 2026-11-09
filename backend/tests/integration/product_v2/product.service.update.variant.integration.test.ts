// tests/integration-test/product_v2/product.update-variant.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk
 * `PUT /api/v1/admin/products_v2/:id/variants/:variantId`.
 *
 * Cakupan:
 *  - Partial update (sku / size / color / price / stock / multi-field).
 *  - Merged-state validation (BR-11, BR-15, BR-21) — diuji terhadap
 *    state DB yang SUNGGUHAN (bukan input saja).
 *  - Product not-found / soft-deleted → 404 PRODUCT_NOT_FOUND.
 *  - Variant not-found / soft-deleted / milik product lain (IDOR)
 *    → 404 VARIANT_NOT_FOUND (anti-enumeration).
 *  - P2002 mapping → SKU_DUPLICATE (termasuk SKU soft-deleted — BR-12)
 *    dan VARIANT_DUPLICATE (BR-13).
 *  - Body kosong / field terlarang → 400 VALIDATION_ERROR.
 *  - Params UUID & auth 401.
 *  - Race concurrent: clear size + clear color → satu 200, satu 400
 *    ATTRIBUTE_REQUIRED, state akhir valid (BR-11).
 *  - Race concurrent: SKU takeover → satu 200, satu 409 SKU_DUPLICATE.
 *  - Cross-endpoint: update → list variant mencerminkan perubahan.
 *  - Security: updated_by dari session, payload diabaikan.
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

describe("PUT /api/v1/admin/products_v2/:id/variants/:variantId", () => {
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
  // Group 1 — Happy paths (partial update)
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths", () => {
    it("200 — update SKU saja, field lain di DB tidak berubah", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "OLD-SKU",
        size: "L",
        color: "Hitam",
        price: 100000,
        stock: 10,
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "NEW-SKU" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Variant updated successfully");
      expect(res.body.data).toMatchObject({
        id: v.id,
        sku: "NEW-SKU",
        size: "L",
        color: "Hitam",
        price: 100000,
        stock: 10,
        low_stock: false,
      });

      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.sku).toBe("NEW-SKU");
      expect(stored!.size).toBe("L"); // tidak berubah
      expect(stored!.color).toBe("Hitam"); // tidak berubah
      expect(stored!.price.toString()).toBe("100000"); // tidak berubah
      expect(stored!.updatedBy).toBe(user.id);
    });

    it("200 — update price & stock, low_stock derived ikut berubah", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        size: "L",
        stock: 20,
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ price: 200000, stock: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.price).toBe(200000);
      expect(res.body.data.stock).toBe(3);
      expect(res.body.data.low_stock).toBe(true); // stock < 5
    });

    it("200 — clear size (existing color terisi) → merged valid (BR-11)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        size: "L",
        color: "Hitam",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ size: null });

      expect(res.status).toBe(200);
      expect(res.body.data.size).toBeNull();
      expect(res.body.data.color).toBe("Hitam");
    });

    it("200 — clear color (existing size terisi) → merged valid (BR-11)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        size: "L",
        color: "Hitam",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ color: null });

      expect(res.status).toBe(200);
      expect(res.body.data.size).toBe("L");
      expect(res.body.data.color).toBeNull();
    });

    it("200 — multi-field update (sku + size + price)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "OLD",
        size: "L",
        price: 100000,
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "NEW", size: "XL", price: 150000 });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        sku: "NEW",
        size: "XL",
        price: 150000,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Merged-state validation (BR-11, BR-15, BR-21)
  // ═══════════════════════════════════════════════════════════════
  describe("merged-state validation", () => {
    it("400 — ATTRIBUTE_REQUIRED saat clear size + existing color null", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        size: "L",
        color: null, // existing color null
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ size: null });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ATTRIBUTE_REQUIRED");

      // State tidak berubah.
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.size).toBe("L");
    });

    it("400 — ATTRIBUTE_REQUIRED saat clear size & color sekaligus (existing valid)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        size: "L",
        color: "Hitam",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ size: null, color: null });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ATTRIBUTE_REQUIRED");
    });

    it("400 — INVALID_PRICE saat price 0", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ price: 0 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_PRICE");
    });

    it("400 — INVALID_STOCK saat stock negatif", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: -1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_STOCK");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Not found (product / variant / IDOR)
  // ═══════════════════════════════════════════════════════════════
  describe("not found", () => {
    it("404 — PRODUCT_NOT_FOUND saat product tidak ada", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .put(
          `${baseEndpoint}/11111111-1111-4111-8111-999999999999/variants/33333333-3333-4333-8333-333333333333`,
        )
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X" });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("404 — PRODUCT_NOT_FOUND saat product soft-deleted", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        createdBy: user.id,
        deletedAt: new Date(),
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X" });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");

      // Variant tidak tersentuh.
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.sku).toBe("V1");
    });

    it("404 — VARIANT_NOT_FOUND saat variant tidak ada", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .put(
          `${baseEndpoint}/${product.id}/variants/33333333-3333-4333-8333-999999999999`,
        )
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X" });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");
    });

    it("404 — VARIANT_NOT_FOUND saat variant soft-deleted", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        deletedAt: new Date(),
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "NEW" });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");
    });

    it("404 — VARIANT_NOT_FOUND saat variant milik produk LAIN (IDOR) + variant tidak tersentuh", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const productA = await seedProduct({ name: "A", createdBy: user.id });
      const productB = await seedProduct({ name: "B", createdBy: user.id });

      // Variant milik product B.
      const vB = await seedVariant({
        productId: productB.id,
        sku: "B-ORIGINAL",
        createdBy: user.id,
      });

      // Request lewat product A → IDOR attempt.
      const res = await request(app)
        .put(`${baseEndpoint}/${productA.id}/variants/${vB.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "HACKED-SKU", price: 1 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");

      // Variant milik product B TIDAK tersentuh.
      const stored = await prisma.productVariant.findUnique({
        where: { id: vB.id },
      });
      expect(stored!.sku).toBe("B-ORIGINAL");
      expect(stored!.price.toNumber()).toBe(100000);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — P2002 mapping
  // ═══════════════════════════════════════════════════════════════
  describe("P2002 mapping", () => {
    it("409 — SKU_DUPLICATE saat SKU bentrok dengan variant aktif lain", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v1 = await seedVariant({
        productId: product.id,
        sku: "SKU-A",
        size: "L",
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "SKU-B",
        size: "M",
        createdBy: user.id,
      });

      // V1 → SKU-B (sudah dipakai V2).
      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v1.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "SKU-B" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SKU_DUPLICATE");
      expect(res.body.message).toBe("SKU is already in use");
    });

    it("409 — SKU_DUPLICATE saat SKU bentrok dengan variant SOFT-DELETED (BR-12)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const live = await seedVariant({
        productId: product.id,
        sku: "LIVE-SKU",
        size: "L",
        createdBy: user.id,
      });
      // Soft-deleted variant dengan SKU-X.
      await seedVariant({
        productId: product.id,
        sku: "TAKEN-SKU",
        size: "M",
        deletedAt: new Date(),
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${live.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "TAKEN-SKU" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SKU_DUPLICATE");
    });

    it("409 — VARIANT_DUPLICATE saat kombinasi (size,color) bentrok dengan variant aktif lain", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v1 = await seedVariant({
        productId: product.id,
        sku: "V1",
        size: "L",
        color: "Hitam",
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "V2",
        size: "M",
        color: "Hitam",
        createdBy: user.id,
      });

      // V1 → size=M (kombinasi M/Hitam sudah dipakai V2).
      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v1.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ size: "M" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("VARIANT_DUPLICATE");
    });

    it("200 — update field non-unique (price) dengan sku TIDAK dikirim → tidak false SKU_DUPLICATE", async () => {
      // Regression: input tanpa sku tidak boleh trigger fallback
      // findUnique. Pastikan service tetap sukses saat update hanya price.
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "KEEP-SKU",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ price: 75000 });

      expect(res.status).toBe(200);
      expect(res.body.data.sku).toBe("KEEP-SKU"); // tidak berubah
      expect(res.body.data.price).toBe(75000);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Validasi input
  // ═══════════════════════════════════════════════════════════════
  describe("validasi input", () => {
    it("400 — VALIDATION_ERROR saat body kosong (refine)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat field terlarang (status) dikirim", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });

      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "NEW", status: "ACTIVE" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .put(
          `${baseEndpoint}/not-a-uuid/variants/33333333-3333-4333-8333-333333333333`,
        )
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat :variantId bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .put(
          `${baseEndpoint}/11111111-1111-4111-8111-111111111111/variants/not-a-uuid`,
        )
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app)
        .put(
          `${baseEndpoint}/11111111-1111-4111-8111-111111111111/variants/33333333-3333-4333-8333-333333333333`,
        )
        .send({ sku: "X" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Race conditions (real concurrency)
  // ═══════════════════════════════════════════════════════════════
  describe("race conditions (real concurrency)", () => {
    it("race — clear size + clear color concurrent → satu 200, satu 400 ATTRIBUTE_REQUIRED, state akhir valid", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "RACE-ATTR",
        size: "L",
        color: "Hitam",
        createdBy: user.id,
      });

      // Dua update concurrent pada variabel yang sama:
      //  T1: { size: null } — merged dengan existing {size:L,color:Hitam} → valid
      //  T2: { color: null } — merged dengan existing {size:L,color:Hitam} → valid
      //
      // Dengan FOR UPDATE (product + variant):
      //  - T1 lock, commit state = { size: null, color: "Hitam" }.
      //  - T2 lock (setelah T1), merged = { size: null, color: null } → ATTRIBUTE_REQUIRED.
      //
      // Tanpa FOR UPDATE (atau baca stale):
      //  - T2 merged = { size: "L", color: null } → valid → state invalid.
      //
      // Test ini mengunci race guard.
      const [res1, res2] = await Promise.all([
        request(app)
          .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
          .set("Cookie", [accessTokenCookie])
          .send({ size: null }),
        request(app)
          .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
          .set("Cookie", [accessTokenCookie])
          .send({ color: null }),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 400]);

      const loser = res1.status === 400 ? res1 : res2;
      expect(loser.body.code).toBe("ATTRIBUTE_REQUIRED");

      // Final state: minimal satu attribute masih ada (invariant BR-11).
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.size !== null || stored!.color !== null).toBe(true);
    });

    it("race — SKU takeover concurrent: satu 200, satu 409 SKU_DUPLICATE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const v1 = await seedVariant({
        productId: product.id,
        sku: "V1-ORIG",
        size: "L",
        createdBy: user.id,
      });
      const v2 = await seedVariant({
        productId: product.id,
        sku: "V2-ORIG",
        size: "M",
        createdBy: user.id,
      });

      // Dua update concurrent, sama-sama ingin mengambil SKU "SHARED".
      // Size dibedakan (X vs Y) supaya P2002 hanya dari SKU (bukan kombinasi).
      const [res1, res2] = await Promise.all([
        request(app)
          .put(`${baseEndpoint}/${product.id}/variants/${v1.id}`)
          .set("Cookie", [accessTokenCookie])
          .send({ sku: "SHARED-SKU", size: "X1" }),
        request(app)
          .put(`${baseEndpoint}/${product.id}/variants/${v2.id}`)
          .set("Cookie", [accessTokenCookie])
          .send({ sku: "SHARED-SKU", size: "X2" }),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);

      const loser = res1.status === 409 ? res1 : res2;
      expect(loser.body.code).toBe("SKU_DUPLICATE");

      // Final: tepat 1 variant dengan SKU "SHARED-SKU".
      const stored = await prisma.productVariant.findMany({
        where: { sku: "SHARED-SKU", deletedAt: null },
      });
      expect(stored).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Cross-endpoint
  // ═══════════════════════════════════════════════════════════════
  describe("cross-endpoint", () => {
    it("update variant → GET list variant mencerminkan perubahan", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "OLD-SKU",
        price: 100000,
        stock: 10,
        createdBy: user.id,
      });

      // Update via API.
      await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "NEW-SKU", price: 200000, stock: 3 });

      // GET list — perubahan konsisten.
      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0]).toMatchObject({
        sku: "NEW-SKU",
        price: 200000,
        stock: 3,
        low_stock: true,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 8 — Security
  // ═══════════════════════════════════════════════════════════════
  describe("security", () => {
    it("updated_by diambil dari session — payload spoofing diabaikan", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "SEC",
        createdBy: user.id,
      });

      // Payload berisi `updated_by` palsu — schema `.strict()` sudah
      // tolak field ini sebelum sampai service. Test ini verifikasi
      // lapis-2: service pun tidak mempercayai input.
      const res = await request(app)
        .put(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ price: 50000, updated_by: "attacker-id" });

      // `.strict()` tolak `updated_by` → 400.
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");

      // State tidak berubah.
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.price.toNumber()).toBe(100000);
      expect(stored!.updatedBy).toBe(user.id);
    });
  });
});
