// tests/integration-test/product_v2/product.create-variant.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk `POST /api/v1/admin/products_v2/:id/variants`.
 *
 * Cakupan:
 *  - Happy path: size only, color only, both — 201 + DTO lengkap.
 *  - Business rules (fast-fail di service):
 *      * size & color dua-duanya null → ATTRIBUTE_REQUIRED.
 *      * price <= 0 → INVALID_PRICE.
 *      * stock < 0 → INVALID_STOCK.
 *  - Race P2002 → mapping ke 409 spesifik:
 *      * SKU duplicate (termasuk SKU soft-deleted — BR-12, EC-PM-C13).
 *      * Kombinasi (size,color) duplicate antar varian aktif.
 *      * Kombinasi reuse SETELAH soft-delete → sukses (partial unique index
 *        WHERE deleted_at IS NULL, DD-PM-08 & EC-PM-C7).
 *  - Product not-found / soft-deleted → 404.
 *  - Product soft-delete concurrent di tengah create → 404 (SELECT FOR UPDATE).
 *  - Concurrent create SKU sama (race real) → satu 201, satu 409.
 *  - Concurrent create kombinasi sama (race real) → satu 201, satu 409.
 *  - Zod strip / type validation → 400 VALIDATION_ERROR.
 *  - Security: created_by & updated_by dari session, bukan payload.
 *
 * Format error: single-error `{ status: "error", code, message }` — tidak
 * ada multi-error di endpoint ini (semua validasi independen → code
 * spesifik).
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

/**
 * Seed produk minimal. Tidak butuh category_id untuk pembuatan
 * variant — service hanya cek `deleted_at IS NULL`.
 */
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
 * Seed variant langsung via Prisma (bypass service). Dipakai untuk
 * menyiapkan state "SKU sudah dipakai" / "kombinasi sudah ada" /
 * "kombinasi soft-deleted" yang tidak bisa dicapai via seed API.
 */
async function seedVariant(opts: SeedVariantOpts) {
  return prisma.productVariant.create({
    data: {
      productId: opts.productId,
      sku: opts.sku,
      // size "L" default: DB CHECK `attribute_required_check` menuntut
      // minimal satu dari size/color. Untuk kasus butuh color-only,
      // override `size: null, color: "..."`.
      size: opts.size === undefined ? "L" : opts.size,
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

describe("POST /api/v1/admin/products_v2/:id/variants", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    // Category tidak dibutuhkan untuk variant service, tapi kalau
    // suatu saat ada FK constraint dari seeding product lain
    // (test sebelumnya), biar aman.
    await prisma.category.create({
      data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
    });
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 1 — Happy paths
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths", () => {
    it("201 — size + color, DTO lengkap, data tersimpan di DB", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({
          sku: "KAOS-L-HTM",
          size: "L",
          color: "Hitam",
          price: 100000,
          stock: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Variant created successfully");
      expect(res.body.data).toMatchObject({
        sku: "KAOS-L-HTM",
        size: "L",
        color: "Hitam",
        price: 100000,
        stock: 10,
        low_stock: false,
      });
      expect(typeof res.body.data.id).toBe("string");

      // Persistensi + audit actor.
      const stored = await prisma.productVariant.findUnique({
        where: { id: res.body.data.id },
      });
      expect(stored).not.toBeNull();
      expect(stored!.createdBy).toBe(user.id);
      expect(stored!.updatedBy).toBe(user.id);
      expect(stored!.productId).toBe(product.id);
      expect(stored!.deletedAt).toBeNull();
    });

    it("201 — size saja (color null)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "SIZE-ONLY", size: "M", price: 50000, stock: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.size).toBe("M");
      expect(res.body.data.color).toBeNull();
    });

    it("201 — color saja (size null)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "COLOR-ONLY", color: "Navy", price: 50000, stock: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.size).toBeNull();
      expect(res.body.data.color).toBe("Navy");
    });

    it("201 — size & color string kosong dinormalisasi ke null (edge) + attribute other terisi", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // size: "" → null (Zod transform). color terisi → valid.
      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({
          sku: "EMPTY-SIZE",
          size: "",
          color: "Merah",
          price: 50000,
          stock: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.size).toBeNull();
      expect(res.body.data.color).toBe("Merah");
    });

    it("201 — low_stock=true saat stock < 5", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "LOW", size: "S", price: 50000, stock: 3 });

      expect(res.status).toBe(201);
      expect(res.body.data.stock).toBe(3);
      expect(res.body.data.low_stock).toBe(true);
    });

    it("201 — low_stock=false saat stock tepat 5 (boundary)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "BOUNDARY", size: "S", price: 50000, stock: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.low_stock).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Business rules
  // ═══════════════════════════════════════════════════════════════
  describe("business rules", () => {
    it("400 — ATTRIBUTE_REQUIRED saat size & color dua-duanya null", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "NO-ATTR", price: 50000, stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.code).toBe("ATTRIBUTE_REQUIRED");

      // Tidak ada write.
      expect(await prisma.productVariant.count()).toBe(0);
    });

    it("400 — ATTRIBUTE_REQUIRED saat size & color string kosong", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({
          sku: "EMPTY-ATTR",
          size: "",
          color: "   ",
          price: 50000,
          stock: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ATTRIBUTE_REQUIRED");
    });

    it("400 — INVALID_PRICE saat price 0", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "PRICE-ZERO", size: "L", price: 0, stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_PRICE");
      expect(await prisma.productVariant.count()).toBe(0);
    });

    it("400 — INVALID_PRICE saat price negatif", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "PRICE-NEG", size: "L", price: -1, stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_PRICE");
    });

    it("400 — INVALID_STOCK saat stock negatif", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "STOCK-NEG", size: "L", price: 50000, stock: -1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_STOCK");
      expect(await prisma.productVariant.count()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Duplicate detection (race P2002 mapping)
  // ═══════════════════════════════════════════════════════════════
  describe("duplicate detection — P2002 mapping", () => {
    it("409 — SKU_DUPLICATE saat SKU sudah dipakai varian aktif di produk lain", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const productA = await seedProduct({ name: "A", createdBy: user.id });
      const productB = await seedProduct({ name: "B", createdBy: user.id });

      // Seed variant aktif dengan SKU X di produk A.
      await seedVariant({
        productId: productA.id,
        sku: "SHARED-SKU",
        createdBy: user.id,
      });

      // Coba create variant dengan SKU X di produk B → SKU unique GLOBAL (BR-12).
      const res = await request(app)
        .post(`${baseEndpoint}/${productB.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "SHARED-SKU", size: "M", price: 50000, stock: 10 });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe("error");
      expect(res.body.code).toBe("SKU_DUPLICATE");
      expect(res.body.message).toBe("SKU is already in use");
    });

    it("409 — SKU_DUPLICATE saat SKU dipakai varian SOFT-DELETED (BR-12, EC-PM-C13)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Seed variant soft-deleted dengan SKU X.
      await seedVariant({
        productId: product.id,
        sku: "REUSED-SKU",
        deletedAt: new Date(),
        createdBy: user.id,
      });

      // Coba create baru dengan SKU X → harus DITOLAK (SKU unique global
      // TANPA filter deleted_at — berbeda dari partial unique kombinasi).
      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "REUSED-SKU", size: "M", price: 50000, stock: 10 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SKU_DUPLICATE");
    });

    it("409 — VARIANT_DUPLICATE saat kombinasi (size,color) sudah ada di produk yang sama", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Seed variant aktif L/Hitam.
      await seedVariant({
        productId: product.id,
        sku: "FIRST-L-HTM",
        size: "L",
        color: "Hitam",
        createdBy: user.id,
      });

      // Coba create kombinasi sama (SKU beda) → partial unique index reject.
      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({
          sku: "SECOND-L-HTM",
          size: "L",
          color: "Hitam",
          price: 50000,
          stock: 5,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("VARIANT_DUPLICATE");
    });

    it("201 — kombinasi (size,color) soft-deleted BOLEH di-reuse (partial unique index, DD-PM-08, EC-PM-C7)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Seed variant soft-deleted L/Hitam.
      await seedVariant({
        productId: product.id,
        sku: "OLD-L-HTM",
        size: "L",
        color: "Hitam",
        deletedAt: new Date(),
        createdBy: user.id,
      });

      // Create varian baru dengan kombinasi sama → SUKSES, karena
      // partial unique index punya `WHERE deleted_at IS NULL`.
      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({
          sku: "NEW-L-HTM",
          size: "L",
          color: "Hitam",
          price: 100000,
          stock: 20,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.sku).toBe("NEW-L-HTM");
      expect(res.body.data.size).toBe("L");
      expect(res.body.data.color).toBe("Hitam");
    });

    it("201 — kombinasi sama (size,color) di PRODUK BERBEDA → sukses (uniqueness per produk)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const productA = await seedProduct({ name: "A", createdBy: user.id });
      const productB = await seedProduct({ name: "B", createdBy: user.id });

      await seedVariant({
        productId: productA.id,
        sku: "A-L-HTM",
        size: "L",
        color: "Hitam",
        createdBy: user.id,
      });

      const res = await request(app)
        .post(`${baseEndpoint}/${productB.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({
          sku: "B-L-HTM",
          size: "L",
          color: "Hitam",
          price: 50000,
          stock: 5,
        });

      expect(res.status).toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Product existence & soft-delete
  // ═══════════════════════════════════════════════════════════════
  describe("product existence", () => {
    it("404 — PRODUCT_NOT_FOUND saat produk tidak ada", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .post(`${baseEndpoint}/11111111-1111-4111-8111-999999999999/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X", size: "L", price: 50000, stock: 10 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
      expect(await prisma.productVariant.count()).toBe(0);
    });

    it("404 — PRODUCT_NOT_FOUND saat produk soft-deleted (BR-05)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        createdBy: user.id,
        deletedAt: new Date(),
      });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X", size: "L", price: 50000, stock: 10 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
      expect(await prisma.productVariant.count()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Zod validation (struktur input)
  // ═══════════════════════════════════════════════════════════════
  describe("zod validation — struktur input", () => {
    it("400 — VALIDATION_ERROR saat sku kosong", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "   ", size: "L", price: 50000, stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat sku tidak dikirim", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ size: "L", price: 50000, stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat price bertipe string (bukan number)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X", size: "L", price: "50000", stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat stock bukan integer (5.5)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X", size: "L", price: 50000, stock: 5.5 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat sku terlalu panjang (> 100 char)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({
          sku: "x".repeat(101),
          size: "L",
          price: 50000,
          stock: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .post(`${baseEndpoint}/not-a-uuid/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "X", size: "L", price: 50000, stock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app)
        .post(`${baseEndpoint}/11111111-1111-4111-8111-111111111111/variants`)
        .send({ sku: "X", size: "L", price: 50000, stock: 10 });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Security
  // ═══════════════════════════════════════════════════════════════
  describe("security", () => {
    it("created_by & updated_by diambil dari session — payload spoofing diabaikan", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Body berisi created_by palsu — schema tidak punya field itu
      // (di-strip Zod default), service pakai adminId dari session.
      await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({
          sku: "SEC",
          size: "L",
          price: 50000,
          stock: 10,
          created_by: "attacker-id",
          updated_by: "attacker-id",
        });

      const stored = await prisma.productVariant.findFirst({
        where: { sku: "SEC" },
      });
      expect(stored!.createdBy).toBe(user.id);
      expect(stored!.updatedBy).toBe(user.id);
      expect(stored!.createdBy).not.toBe("attacker-id");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Race condition (real concurrency)
  // ═══════════════════════════════════════════════════════════════
  describe("race conditions (real concurrency)", () => {
    it("race — concurrent create SKU sama: satu 201, satu 409 SKU_DUPLICATE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Dua request concurrent, SKU sama, combination beda
      // (supaya yang kalah kena unique SKU, bukan kombinasi).
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`${baseEndpoint}/${product.id}/variants`)
          .set("Cookie", [accessTokenCookie])
          .send({ sku: "RACE-SKU", size: "L", price: 50000, stock: 10 }),
        request(app)
          .post(`${baseEndpoint}/${product.id}/variants`)
          .set("Cookie", [accessTokenCookie])
          .send({ sku: "RACE-SKU", size: "XL", price: 50000, stock: 10 }),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      // Yang kalah = SKU_DUPLICATE.
      const loser = res1.status === 409 ? res1 : res2;
      expect(loser.body.code).toBe("SKU_DUPLICATE");

      // Final state: tepat 1 variant dengan SKU tersebut.
      const stored = await prisma.productVariant.findMany({
        where: { sku: "RACE-SKU" },
      });
      expect(stored).toHaveLength(1);
    });

    it("race — concurrent create kombinasi sama (SKU beda): satu 201, satu 409 VARIANT_DUPLICATE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`${baseEndpoint}/${product.id}/variants`)
          .set("Cookie", [accessTokenCookie])
          .send({
            sku: "COMBO-1",
            size: "L",
            color: "Hitam",
            price: 50000,
            stock: 10,
          }),
        request(app)
          .post(`${baseEndpoint}/${product.id}/variants`)
          .set("Cookie", [accessTokenCookie])
          .send({
            sku: "COMBO-2",
            size: "L",
            color: "Hitam",
            price: 50000,
            stock: 10,
          }),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      const loser = res1.status === 409 ? res1 : res2;
      expect(loser.body.code).toBe("VARIANT_DUPLICATE");

      // Final state: tepat 1 variant aktif dengan kombinasi L/Hitam.
      const stored = await prisma.productVariant.findMany({
        where: {
          productId: product.id,
          size: "L",
          color: "Hitam",
          deletedAt: null,
        },
      });
      expect(stored).toHaveLength(1);
    });

    it("race — product di-soft-delete saat create variant: salah satu dapat 404 (SELECT FOR UPDATE)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Concurrent: create variant + soft delete product.
      // SELECT FOR UPDATE di create memblok UPDATE deleted_at
      // sampai create commit.
      //
      // Skenario:
      //  - Create menang lock dulu → insert sukses → 201, lalu
      //    delete → sukses (produk diarsipkan, variant tetap ada
      //    tapi jadi bagian dari produk yang sudah deleted).
      //  - Delete menang lock dulu → commit deleted_at, lalu create
      //    acquire lock → SELECT WHERE deleted_at IS NULL → 0 rows
      //    → 404.
      //
      // Keduanya adalah state konsisten — yang DILARANG adalah
      // "create sukses ke produk yang SUDAH soft-deleted" (row
      // ditolak oleh WHERE deleted_at IS NULL).
      const [createRes, deleteRes] = await Promise.all([
        request(app)
          .post(`${baseEndpoint}/${product.id}/variants`)
          .set("Cookie", [accessTokenCookie])
          .send({ sku: "RACE-DEL", size: "L", price: 50000, stock: 10 }),
        request(app)
          .delete(`${baseEndpoint}/${product.id}`)
          .set("Cookie", [accessTokenCookie]),
      ]);

      // Delete selalu 200 (transisi ACTIVE/DRAFT → soft-delete).
      expect(deleteRes.status).toBe(200);

      // Create: 201 (menang lock) atau 404 (delete sudah commit).
      expect([201, 404]).toContain(createRes.status);

      // Invariant: kalau create = 404, TIDAK boleh ada variant dengan SKU tsb.
      if (createRes.status === 404) {
        const stored = await prisma.productVariant.findFirst({
          where: { sku: "RACE-DEL" },
        });
        expect(stored).toBeNull();
      }
    });
  });
});
