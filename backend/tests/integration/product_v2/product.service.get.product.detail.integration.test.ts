// src/modules/product/product.detail.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookie, getAccesTokenCookieAdmin } from "../helpers/auth";
import { seedProduct } from "./helpers.product.integration";

/**
 * Integration test untuk `GET /api/v1/admin/products_v2/:id`.
 *
 * Cakupan (bukan logika bisnis — itu wilayah unit test):
 *  - Route GET detail terdaftar & middleware `validate` params+query terpasang.
 *  - Params `:id` divalidasi UUID → 400 untuk format salah.
 *  - `include_deleted` semantik ganda:
 *      * product soft-deleted → 404 (false) / 200 (true)
 *      * varian soft-deleted → disembunyikan (false) / tampil (true)
 *  - Nested response lengkap: category, variants[], images[].
 *  - `low_stock` derived dari `stock < 5` (BR-23) — bukan field DB.
 *  - Ordering: images primary dulu, lalu `sort_order` asc.
 *  - Konversi DTO: `price` Decimal → number, `Date` → string ISO,
 *    `deleted_at` string | null.
 *  - Tidak bocorkan field Prisma: `file_key`, `categoryId`, `createdBy`,
 *    `createdAt` (camelCase).
 *  - `category: null` untuk produk DRAFT tanpa kategori (BR-24 hanya
 *    wajib saat publish).
 *  - 401 tanpa auth.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

describe("GET /api/v1/admin/products_v2/:id", () => {
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

  const baseEndpoint = "/api/v1/admin/products_v2";

  // ── Case 1: Happy path — DTO lengkap ────────────────────────
  it("200 — detail DTO lengkap: category, nested variants & images", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();

    const product = await seedProduct({
      name: "Kaos Hitam Premium",
      categoryId: CATEGORY_ID,
      createdBy: user.id,
      variants: [
        {
          sku: "KAOS-HTM-L",
          price: 100000,
          stock: 20,
          size: "L",
          color: "Hitam",
        },
        {
          sku: "KAOS-HTM-M",
          price: 100000,
          stock: 3,
          size: "M",
          color: "Hitam",
        },
      ],
      images: [
        { url: "https://img/kaos-2.png", isPrimary: false, sortOrder: 0 },
        { url: "https://img/kaos-1.png", isPrimary: true, sortOrder: 5 },
      ],
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product retrieved successfully");

    const data = res.body.data;
    expect(data).toMatchObject({
      id: product.id,
      name: "Kaos Hitam Premium",
      description: null,
      category: { id: CATEGORY_ID, name: "Atasan" },
      status: "DRAFT",
      created_by: user.id,
      updated_by: user.id,
    });
    expect(typeof data.created_at).toBe("string");
    expect(typeof data.updated_at).toBe("string");

    // Variants
    expect(data.variants).toHaveLength(2);
    const l = data.variants.find((v: any) => v.sku === "KAOS-HTM-L");
    const m = data.variants.find((v: any) => v.sku === "KAOS-HTM-M");

    expect(l).toMatchObject({
      size: "L",
      color: "Hitam",
      price: 100000, // number, bukan Decimal/string
      stock: 20,
      low_stock: false, // 20 >= 5
      deleted_at: null,
    });
    expect(m).toMatchObject({
      size: "M",
      price: 100000,
      stock: 3,
      low_stock: true, // 3 < 5 → BR-23
      deleted_at: null,
    });

    // Images: primary di depan
    expect(data.images).toHaveLength(2);
    expect(data.images[0]).toMatchObject({
      url: "https://img/kaos-1.png",
      is_primary: true,
      sort_order: 5,
    });
    expect(data.images[1]).toMatchObject({
      url: "https://img/kaos-2.png",
      is_primary: false,
      sort_order: 0,
    });

    // Tidak bocorkan field internal Prisma
    expect(data).not.toHaveProperty("categoryId");
    expect(data).not.toHaveProperty("createdBy");
    expect(data).not.toHaveProperty("createdAt");
    expect(data).not.toHaveProperty("deletedAt");
    expect(data.variants[0]).not.toHaveProperty("deletedAt");
    expect(data.variants[0]).not.toHaveProperty("productId");
    expect(data.images[0]).not.toHaveProperty("fileKey");
    expect(data.images[0]).not.toHaveProperty("createdBy");
    expect(data.images[0]).not.toHaveProperty("createdAt");
  });

  // ── Case 2: Produk tanpa kategori (DRAFT allowed) ───────────
  it("200 — category:null untuk DRAFT tanpa kategori", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Topi",
      categoryId: null,
      createdBy: user.id,
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.category).toBeNull();
  });

  // ── Case 3: low_stock boundary — stock 5 tidak low ──────────
  it.each([
    [0, true],
    [4, true],
    [5, false],
  ])("200 — stok %i → low_stock %s", async (stock, expected) => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: `SKU-${stock}`, price: 50000, stock }],
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.variants[0].low_stock).toBe(expected);
  });

  it("200 — price desimal tidak terpotong dan bertipe number", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: "DEC", price: 49999.99, stock: 10 }],
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.variants[0].price).toBe(49999.99);
  });

  // ── Case 4: Varian soft-deleted disembunyikan default ──────
  it("200 — varian soft-deleted disembunyikan saat include_deleted=false (default)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [
        { sku: "LIVE", price: 100000, stock: 10 },
        { sku: "DELETED", price: 100000, stock: 5, deletedAt: new Date() },
      ],
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.variants).toHaveLength(1);
    expect(res.body.data.variants[0].sku).toBe("LIVE");
  });

  // ── Case 5: include_deleted=true — varian deleted tampil ───
  it("200 — include_deleted=true menampilkan varian soft-deleted dengan deleted_at terisi", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const deletedAt = new Date("2026-10-01T00:00:00.000Z");
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [
        { sku: "LIVE", price: 100000, stock: 10 },
        { sku: "DELETED", price: 100000, stock: 5, deletedAt },
      ],
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}?include_deleted=true`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.variants).toHaveLength(2);

    const deleted = res.body.data.variants.find(
      (v: any) => v.sku === "DELETED",
    );
    expect(deleted).toMatchObject({
      sku: "DELETED",
      deleted_at: deletedAt.toISOString(),
    });
  });

  // ── Case 6: Produk soft-deleted + default → 404 ────────────
  it("404 — PRODUCT_NOT_FOUND saat produk soft-deleted & include_deleted=false", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Arsip",
      createdBy: user.id,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("200 — urutan gambar: primary dulu, lalu sort_order asc", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      images: [
        { url: "https://img/b.png", isPrimary: false, sortOrder: 2 },
        { url: "https://img/primary.png", isPrimary: true, sortOrder: 9 },
        { url: "https://img/a.png", isPrimary: false, sortOrder: 1 },
      ],
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.images.map((i: any) => i.url)).toEqual([
      "https://img/primary.png",
      "https://img/a.png",
      "https://img/b.png",
    ]);
  });

  it("200 — gambar dengan sort_order sama diurutkan createdAt asc", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    // Diinsert terbalik dari urutan createdAt.
    for (const [url, createdAt] of [
      ["https://img/second.png", new Date("2026-10-01T00:00:02.000Z")],
      ["https://img/first.png", new Date("2026-10-01T00:00:01.000Z")],
    ] as const) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url,
          fileKey: `key-${url}`,
          isPrimary: false,
          sortOrder: 0,
          createdAt,
          createdBy: user.id,
        },
      });
    }

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.images.map((i: any) => i.url)).toEqual([
      "https://img/first.png",
      "https://img/second.png",
    ]);
  });

  // ── Case 7: Produk soft-deleted + include_deleted → 200 ────
  it("200 — include_deleted=true membuka produk soft-deleted (audit view)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Arsip",
      createdBy: user.id,
      deletedAt: new Date(),
      variants: [{ sku: "A", price: 100000, stock: 10 }],
    });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}?include_deleted=true`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product.id);
    expect(res.body.data.variants).toHaveLength(1);
  });

  // ── Case 8: Produk tidak ada (UUID valid, bukan milik siapapun)
  it("404 — PRODUCT_NOT_FOUND saat UUID valid tapi produk tidak ada", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .get(`${baseEndpoint}/11111111-1111-4111-8111-999999999999`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 9: Params bukan UUID ──────────────────────────────
  it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .get(`${baseEndpoint}/not-a-uuid`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 10: include_deleted nilai invalid ─────────────────
  it("400 — VALIDATION_ERROR saat include_deleted=1 (hanya true/false)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}?include_deleted=1`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("403 — FORBIDDEN untuk user non-admin (buyer)", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();

    const res = await request(app)
      .get(`${baseEndpoint}/11111111-1111-4111-8111-111111111111`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  // ── Case 11: Tanpa auth ────────────────────────────────────
  it("401 — UNAUTHORIZED tanpa auth", async () => {
    const res = await request(app).get(
      `${baseEndpoint}/11111111-1111-4111-8111-111111111111`,
    );

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  // ── Case 13: Ordering varian deterministik (createdAt asc) ─
  it("200 — urutan varian stabil: createdAt asc", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();

    const product = await prisma.product.create({
      data: {
        name: "Kaos",
        status: "DRAFT",
        createdBy: user.id,
        updatedBy: user.id,
      },
    });

    // Sengaja diinsert TIDAK berurutan dengan createdAt-nya,
    // supaya test gagal kalau orderBy hilang (urutan insert/PK bisa kebetulan sama).
    const variants = [
      {
        sku: "CCC",
        size: "L",
        createdAt: new Date("2026-10-01T00:00:03.000Z"),
      },
      {
        sku: "AAA",
        size: "S",
        createdAt: new Date("2026-10-01T00:00:01.000Z"),
      },
      {
        sku: "BBB",
        size: "M",
        createdAt: new Date("2026-10-01T00:00:02.000Z"),
      },
    ];

    for (const v of variants) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          size: v.size,
          price: 100000,
          stock: 10,
          createdAt: v.createdAt,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
    }

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.variants.map((v: any) => v.sku)).toEqual([
      "AAA",
      "BBB",
      "CCC",
    ]);
  });

  // ── Case 14: Produk tanpa varian & gambar — array kosong ───
  it("200 — produk baru (tanpa varian/gambar) → array kosong, bukan null", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Baru", createdBy: user.id });

    const res = await request(app)
      .get(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.variants).toEqual([]);
    expect(res.body.data.images).toEqual([]);
  });
});
