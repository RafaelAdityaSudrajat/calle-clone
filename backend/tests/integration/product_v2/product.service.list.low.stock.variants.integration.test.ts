// tests/integration-test/product_v2/product.low-stock.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk `GET /api/v1/admin/products_v2/low-stock`.
 *
 * Cakupan:
 *  - Filter BR-23: `stock < 5` — boundary 4 ikut, 5 TIDAK ikut.
 *  - Exclude varian soft-deleted (BR-14).
 *  - Exclude varian dari produk soft-deleted (BR-05) — konsisten
 *    dengan endpoint variant lain.
 *  - Include semua status produk (DRAFT/ACTIVE/INACTIVE) — admin
 *    butuh signal low-stock dari semua status.
 *  - Order deterministik: `stock ASC, id ASC` (paling kritis dulu).
 *  - DTO shape: `variant_id`, `product_id`, `product_name`, `sku`,
 *    `size`, `color`, `stock` (snake_case, cross-entity identifier).
 *  - DTO tidak bocorkan field internal (`price`, `createdBy`, dsb).
 *  - Route ordering: `GET /products/low-stock` tidak ditangkap oleh
 *    `GET /:id` (yang akan reject `"low-stock"` sebagai UUID).
 *  - Auth 401.
 *  - Cross-endpoint: update stock → muncul di list / hilang dari list.
 *  - Cross-endpoint: delete variant → hilang dari list.
 *  - Read-only endpoint — tidak ada Zod validation (no body/query/params).
 *
 * Format error (Opsi B): single-error `{ status: "error", code, message }`.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const baseEndpoint = "/api/v1/admin/products_v2";
const lowStockEndpoint = `${baseEndpoint}/low-stock`;

// UUID tetap → order deterministik (orderBy: stock ASC, id ASC).
const PRODUCT_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ── Seed helpers ───────────────────────────────────────────────────

interface SeedProductOpts {
  id?: string;
  name?: string;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  deletedAt?: Date | null;
  createdBy: string;
}

async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      ...(opts.id ? { id: opts.id } : {}),
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
  id?: string;
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
 * Seed variant. Default size = sku (mencegah collision partial
 * unique index `(product_id, COALESCE(size,''), COALESCE(color,''))`
 * saat seed multiple variants untuk produk yang sama).
 */
async function seedVariant(opts: SeedVariantOpts) {
  return prisma.productVariant.create({
    data: {
      ...(opts.id ? { id: opts.id } : {}),
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

describe("GET /api/v1/admin/products_v2/low-stock", () => {
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
  // Group 1 — Happy paths & filter boundaries
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths & filter boundaries", () => {
    it("200 — filter BR-23: hanya stock < 5 (boundary 4 ikut, 5 & 10 TIDAK ikut)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Boundary: 0, 3, 4 → low; 5, 10 → bukan low.
      await seedVariant({
        productId: product.id,
        sku: "S-0",
        stock: 0,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "S-3",
        stock: 3,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "S-4",
        stock: 4,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "S-5",
        stock: 5,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "S-10",
        stock: 10,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Low stock variants retrieved");
      expect(Array.isArray(res.body.data.items)).toBe(true);

      const skus = res.body.data.items.map((i: any) => i.sku).sort();
      expect(skus).toEqual(["S-0", "S-3", "S-4"]);
    });

    it("200 — empty result saat tidak ada varian low-stock", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      await seedVariant({
        productId: product.id,
        sku: "OK",
        stock: 20,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
    });

    it("200 — multiple produk: hasil gabungan lintas produk", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const productA = await seedProduct({
        id: PRODUCT_A_ID,
        name: "Kaos",
        createdBy: user.id,
      });
      const productB = await seedProduct({
        id: PRODUCT_B_ID,
        name: "Topi",
        createdBy: user.id,
      });

      await seedVariant({
        id: "11111111-1111-4111-8111-000000000001",
        productId: productA.id,
        sku: "A-LOW",
        stock: 2,
        createdBy: user.id,
      });
      await seedVariant({
        id: "11111111-1111-4111-8111-000000000002",
        productId: productB.id,
        sku: "B-LOW",
        stock: 1,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      const skus = res.body.data.items.map((i: any) => i.sku).sort();
      expect(skus).toEqual(["A-LOW", "B-LOW"]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Filter soft-deleted
  // ═══════════════════════════════════════════════════════════════
  describe("filter soft-deleted (BR-05, BR-14)", () => {
    it("varian soft-deleted TIDAK muncul (BR-14)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      await seedVariant({
        productId: product.id,
        sku: "LIVE-LOW",
        stock: 2,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "DELETED-LOW",
        stock: 2,
        deletedAt: new Date(),
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].sku).toBe("LIVE-LOW");
    });

    it("varian dari produk soft-deleted TIDAK muncul (BR-05)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const activeProduct = await seedProduct({
        id: PRODUCT_A_ID,
        name: "Active",
        createdBy: user.id,
      });
      const archivedProduct = await seedProduct({
        id: PRODUCT_B_ID,
        name: "Archived",
        deletedAt: new Date(),
        createdBy: user.id,
      });

      await seedVariant({
        productId: activeProduct.id,
        sku: "ACTIVE-LOW",
        stock: 2,
        createdBy: user.id,
      });
      await seedVariant({
        productId: archivedProduct.id,
        sku: "ARCHIVED-LOW",
        stock: 2,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].sku).toBe("ACTIVE-LOW");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Semua status produk ikut
  // ═══════════════════════════════════════════════════════════════
  describe("semua status produk (DRAFT/ACTIVE/INACTIVE) ikut", () => {
    it("varian dari produk DRAFT, ACTIVE, INACTIVE semuanya muncul", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const draft = await seedProduct({
        id: PRODUCT_A_ID,
        status: "DRAFT",
        createdBy: user.id,
      });
      const active = await seedProduct({
        id: PRODUCT_B_ID,
        status: "ACTIVE",
        createdBy: user.id,
      });
      const inactive = await seedProduct({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "INACTIVE",
        createdBy: user.id,
      });

      await seedVariant({
        productId: draft.id,
        sku: "DRAFT-V",
        stock: 2,
        createdBy: user.id,
      });
      await seedVariant({
        productId: active.id,
        sku: "ACTIVE-V",
        stock: 2,
        createdBy: user.id,
      });
      await seedVariant({
        productId: inactive.id,
        sku: "INACTIVE-V",
        stock: 2,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(3);
      const skus = res.body.data.items.map((i: any) => i.sku).sort();
      expect(skus).toEqual(["ACTIVE-V", "DRAFT-V", "INACTIVE-V"]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — DTO shape
  // ═══════════════════════════════════════════════════════════════
  describe("DTO shape", () => {
    it("item memuat snake_case field yang tepat, TIDAK bocorkan field internal", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        id: PRODUCT_A_ID,
        name: "Kaos Premium",
        createdBy: user.id,
      });
      await seedVariant({
        id: "11111111-1111-4111-8111-000000000001",
        productId: product.id,
        sku: "LOW-1",
        size: "L",
        color: "Hitam",
        price: 150000,
        stock: 2,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      const item = res.body.data.items[0];

      // Field yang WAJIB ada (snake_case, cross-entity ID).
      expect(item).toEqual({
        variant_id: "11111111-1111-4111-8111-000000000001",
        product_id: PRODUCT_A_ID,
        product_name: "Kaos Premium",
        sku: "LOW-1",
        size: "L",
        color: "Hitam",
        stock: 2,
      });

      // Field internal Prisma TIDAK boleh bocor.
      expect(item).not.toHaveProperty("id");
      expect(item).not.toHaveProperty("productId");
      expect(item).not.toHaveProperty("product");
      expect(item).not.toHaveProperty("price");
      expect(item).not.toHaveProperty("createdBy");
      expect(item).not.toHaveProperty("updatedBy");
      expect(item).not.toHaveProperty("createdAt");
      expect(item).not.toHaveProperty("deletedAt");
      expect(item).not.toHaveProperty("low_stock"); // implisit true
    });

    it("size null & color null → dikembalikan sebagai null (bukan string kosong)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      // size=null, color=null TIDAK valid (CHECK constraint BR-11) —
      // jadi kita set eksplisit size=null, color="Navy".
      await seedVariant({
        productId: product.id,
        sku: "NAVY-ONLY",
        size: null,
        color: "Navy",
        stock: 1,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].size).toBeNull();
      expect(res.body.data.items[0].color).toBe("Navy");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Order deterministik
  // ═══════════════════════════════════════════════════════════════
  describe("order deterministik (stock ASC, id ASC)", () => {
    it("varian terurut by stock ASC — paling kritis dulu", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Seed acak urutan insert, tapi stock berbeda → harus terurut
      // by stock di response.
      await seedVariant({
        id: "11111111-1111-4111-8111-000000000001",
        productId: product.id,
        sku: "STOCK-3",
        stock: 3,
        createdBy: user.id,
      });
      await seedVariant({
        id: "11111111-1111-4111-8111-000000000002",
        productId: product.id,
        sku: "STOCK-0",
        stock: 0,
        createdBy: user.id,
      });
      await seedVariant({
        id: "11111111-1111-4111-8111-000000000003",
        productId: product.id,
        sku: "STOCK-1",
        stock: 1,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items.map((i: any) => i.sku)).toEqual([
        "STOCK-0",
        "STOCK-1",
        "STOCK-3",
      ]);
    });

    it("tiebreaker id ASC saat stock sama — order stabil antar request", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Semua stock sama → urutan ditentukan id ASC.
      await seedVariant({
        id: "11111111-1111-4111-8111-000000000003",
        productId: product.id,
        sku: "V-C",
        stock: 2,
        createdBy: user.id,
      });
      await seedVariant({
        id: "11111111-1111-4111-8111-000000000001",
        productId: product.id,
        sku: "V-A",
        stock: 2,
        createdBy: user.id,
      });
      await seedVariant({
        id: "11111111-1111-4111-8111-000000000002",
        productId: product.id,
        sku: "V-B",
        stock: 2,
        createdBy: user.id,
      });

      const fetch = () =>
        request(app).get(lowStockEndpoint).set("Cookie", [accessTokenCookie]);

      const [r1, r2, r3] = await Promise.all([fetch(), fetch(), fetch()]);
      const skus1 = r1.body.data.items.map((i: any) => i.sku);
      const skus2 = r2.body.data.items.map((i: any) => i.sku);
      const skus3 = r3.body.data.items.map((i: any) => i.sku);

      // Order konsisten antar concurrent request (tiebreaker id).
      expect(skus1).toEqual(skus2);
      expect(skus2).toEqual(skus3);
      // Urut by id ASC: 001 < 002 < 003 → V-A, V-B, V-C.
      expect(skus1).toEqual(["V-A", "V-B", "V-C"]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Route ordering regression
  // ═══════════════════════════════════════════════════════════════
  describe("route ordering regression", () => {
    it("`/low-stock` TIDAK ditangkap oleh `/:id` (bukan 400 'id must be UUID')", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);

      // Kalau route `/:id` didaftarkan SEBELUM `/low-stock`, request
      // ini akan match `/:id` dengan `id="low-stock"` → 400
      // VALIDATION_ERROR dari Zod UUID check. Test ini mengunci
      // route ordering agar tidak regresi.
      expect(res.status).toBe(200);
      expect(res.status).not.toBe(400);
      expect(res.body.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Auth
  // ═══════════════════════════════════════════════════════════════
  describe("auth", () => {
    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app).get(lowStockEndpoint);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 8 — Cross-endpoint
  // ═══════════════════════════════════════════════════════════════
  describe("cross-endpoint", () => {
    it("update stock via PATCH → varian masuk list saat stock jadi < 5", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "CROSS",
        stock: 20, // tidak low
        createdBy: user.id,
      });

      // Sebelum: kosong.
      const before = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);
      expect(before.body.data.items).toEqual([]);

      // PATCH stock ke 3.
      await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 3 });

      // Sesudah: muncul.
      const after = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);
      expect(after.body.data.items).toHaveLength(1);
      expect(after.body.data.items[0].sku).toBe("CROSS");
      expect(after.body.data.items[0].stock).toBe(3);
    });

    it("update stock via PATCH → varian hilang dari list saat stock jadi >= 5", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "RESTOCKED",
        stock: 2, // low
        createdBy: user.id,
      });

      // Sebelum: muncul.
      const before = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);
      expect(before.body.data.items).toHaveLength(1);

      // PATCH stock ke 20.
      await request(app)
        .patch(`${baseEndpoint}/${product.id}/variants/${v.id}/stock`)
        .set("Cookie", [accessTokenCookie])
        .send({ stock: 20 });

      // Sesudah: kosong.
      const after = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);
      expect(after.body.data.items).toEqual([]);
    });

    it("delete variant via DELETE → hilang dari list low-stock", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "TO-DELETE",
        stock: 2,
        createdBy: user.id,
      });

      // Sebelum: muncul.
      const before = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);
      expect(before.body.data.items).toHaveLength(1);

      // Soft-delete via endpoint.
      await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      // Sesudah: kosong (BR-14).
      const after = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);
      expect(after.body.data.items).toEqual([]);
    });

    it("delete product via DELETE → varian dari produk ikut hilang dari list", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      await seedVariant({
        productId: product.id,
        sku: "ORPHAN-LOW",
        stock: 2,
        createdBy: user.id,
      });

      // Sebelum: muncul.
      const before = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);
      expect(before.body.data.items).toHaveLength(1);

      // Soft-delete product.
      await request(app)
        .delete(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]);

      // Sesudah: kosong (varian dari produk soft-deleted tidak muncul).
      const after = await request(app)
        .get(lowStockEndpoint)
        .set("Cookie", [accessTokenCookie]);
      expect(after.body.data.items).toEqual([]);
    });
  });
});
