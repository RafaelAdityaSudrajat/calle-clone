// src/modules/product/product.list.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookie, getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk `GET /api/v1/admin/products_v2`.
 *
 * Cakupan (bukan logika bisnis — itu wilayah unit test):
 *  - Route GET terdaftar & middleware terpasang.
 *  - `validate(listProductsQuerySchema, "query")` benar-benar menimpa
 *    `req.query` → `page`/`limit` jadi number (regresi `take: "5"` tidak
 *    boleh muncul lagi).
 *  - Envelope `{ success, message, data: { items, pagination } }`.
 *  - Filter: status, category_id, search (nama & SKU), include_deleted.
 *  - Eager load: primary image + variant_count + total_stock benar.
 *  - Varian soft-deleted TIDAK dihitung (BR-14).
 *  - DTO tidak membocorkan field Prisma (camelCase).
 *  - Pagination math (`total_pages`) benar, termasuk saat kosong (=0).
 *  - 400 untuk query invalid, 401 tanpa auth.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

async function seedCategory() {
  await prisma.category.create({
    data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
  });
}

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
  createdAt?: Date;
}

/**
 * Seed satu produk beserta varian dan gambar.
 *
 * Catatan:
 *  - `size` default "L" — CHECK constraint di DB mensyaratkan minimal
 *    salah satu dari size/color terisi (BR-11). Tanpa default ini,
 *    insert akan gagal di level DB.
 *  - `fileKey` di-generate dari url karena kolom NOT NULL dan tidak
 *    dipakai assertion DTO.
 */
async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      name: opts.name,
      status: opts.status ?? "DRAFT",
      categoryId: opts.categoryId ?? null,
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
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

describe("GET /api/v1/admin/products_v2", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    await seedCategory();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  const productEndpoint = "/api/v1/admin/products_v2";

  // ── Case 1: Happy path — DTO + eager load + pagination ──────
  it("200 — list DTO lengkap: category, primary image, variant stats, pagination", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();

    await seedProduct({
      name: "Kaos Hitam",
      categoryId: CATEGORY_ID,
      createdBy: user.id,
      variants: [
        { sku: "KAOS-L", price: 100000, stock: 5, size: "L", color: "Hitam" },
        { sku: "KAOS-M", price: 100000, stock: 10, size: "M", color: "Hitam" },
      ],
      images: [{ url: "https://img/kaos.png", isPrimary: true }],
    });
    await seedProduct({
      name: "Topi Baseball",
      createdBy: user.id,
      variants: [{ sku: "TOPI-001", price: 50000, stock: 20 }],
      images: [{ url: "https://img/topi.png", isPrimary: true }],
    });

    const res = await request(app)
      .get(productEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Products retrieved successfully");

    expect(res.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      total_pages: 1,
    });
    expect(res.body.data.items).toHaveLength(2);

    const kaos = res.body.data.items.find((i: any) => i.name === "Kaos Hitam");
    expect(kaos).toMatchObject({
      category: { id: CATEGORY_ID, name: "Atasan" },
      status: "DRAFT",
      primary_image_url: "https://img/kaos.png",
      variant_count: 2,
      total_stock: 15,
    });
    expect(typeof kaos.created_at).toBe("string");
    expect(typeof kaos.updated_at).toBe("string");

    // Tidak bocorkan nama kolom Prisma.
    expect(kaos).not.toHaveProperty("categoryId");
    expect(kaos).not.toHaveProperty("createdBy");
    expect(kaos).not.toHaveProperty("createdAt");
    expect(kaos).not.toHaveProperty("updatedAt");
  });

  // ── Case 2: Filter by status ────────────────────────────────
  it("200 — filter ?status hanya mengembalikan produk dengan status itu", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({ name: "Draft 1", status: "DRAFT", createdBy: user.id });
    await seedProduct({
      name: "Aktif 1",
      status: "ACTIVE",
      createdBy: user.id,
    });

    const res = await request(app)
      .get(`${productEndpoint}?status=ACTIVE`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      name: "Aktif 1",
      status: "ACTIVE",
    });
    expect(res.body.data.pagination.total).toBe(1);
  });

  // ── Case 3: Filter by category_id ───────────────────────────
  it("200 — filter ?category_id hanya mengembalikan produk di kategori itu", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({
      name: "Dengan Kategori",
      categoryId: CATEGORY_ID,
      createdBy: user.id,
    });
    await seedProduct({
      name: "Tanpa Kategori",
      categoryId: null,
      createdBy: user.id,
    });

    const res = await request(app)
      .get(`${productEndpoint}?category_id=${CATEGORY_ID}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe("Dengan Kategori");
  });

  // ── Case 4: Search by nama produk (ILIKE) ──────────────────
  it("200 — search nama produk case-insensitive (ILIKE)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({ name: "Kaos Hitam Premium", createdBy: user.id });
    await seedProduct({ name: "Topi Baseball", createdBy: user.id });

    const res = await request(app)
      .get(`${productEndpoint}?search=KAOS`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe("Kaos Hitam Premium");
  });

  // ── Case 5: Search by SKU (join varian) ────────────────────
  it("200 — search SKU varian menemukan produk induknya", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [{ sku: "KAOS-HTM-L", price: 100000, stock: 5 }],
    });
    await seedProduct({
      name: "Topi",
      createdBy: user.id,
      variants: [{ sku: "TOPI-001", price: 50000, stock: 10 }],
    });

    const res = await request(app)
      .get(`${productEndpoint}?search=HTM-L`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe("Kaos");
  });

  it("200 — produk tanpa gambar & varian: null dan 0", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({ name: "Kosong", createdBy: user.id });

    const res = await request(app)
      .get(productEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.items[0]).toMatchObject({
      name: "Kosong",
      primary_image_url: null,
      variant_count: 0,
      total_stock: 0,
    });
  });

  it("200 — search + status: OR tidak menimpa filter status", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({
      name: "Kaos Aktif",
      status: "ACTIVE",
      createdBy: user.id,
    });
    await seedProduct({
      name: "Kaos Draft",
      status: "DRAFT",
      createdBy: user.id,
    });
    await seedProduct({
      name: "Topi Aktif",
      status: "ACTIVE",
      createdBy: user.id,
    });

    const res = await request(app)
      .get(`${productEndpoint}?search=kaos&status=ACTIVE`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.items.map((i: any) => i.name)).toEqual(["Kaos Aktif"]);
    expect(res.body.data.pagination.total).toBe(1);
  });

  it("200 — search SKU varian soft-deleted TIDAK menemukan produk (keputusan sadar)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [
        { sku: "KAOS-OLD", price: 100000, stock: 5, deletedAt: new Date() },
      ],
    });

    const res = await request(app)
      .get(`${productEndpoint}?search=KAOS-OLD`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.items).toEqual([]);
  });

  it("200 — ?page=99 melewati total: items kosong, total tetap benar", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({ name: "A", createdBy: user.id });
    await seedProduct({ name: "B", createdBy: user.id });

    const res = await request(app)
      .get(`${productEndpoint}?page=99`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pagination).toEqual({
      page: 99,
      limit: 10,
      total: 2,
      total_pages: 1,
    });
  });

  // ── Case 6: Pagination math (page 2, limit 2, 5 rows) ──────
  it("200 — pagination ?page=2&limit=2 dari 5 produk, urut createdAt desc", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    for (let i = 1; i <= 5; i++) {
      await seedProduct({
        name: `Produk ${i}`,
        createdBy: user.id,
        createdAt: new Date(`2026-10-0${i}T00:00:00.000Z`), // eksplisit, tidak bergantung timing
      });
    }

    const res = await request(app)
      .get(`${productEndpoint}?page=2&limit=2`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((i: any) => i.name)).toEqual([
      "Produk 3",
      "Produk 2",
    ]);
    expect(res.body.data.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      total_pages: 3,
    });
  });

  // ── Case 7: Default menyembunyikan soft-deleted ────────────
  it("200 — soft-deleted disembunyikan secara default", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({ name: "Live", createdBy: user.id });
    await seedProduct({
      name: "Deleted",
      createdBy: user.id,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .get(productEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe("Live");
    expect(res.body.data.pagination.total).toBe(1);
  });

  // ── Case 8: include_deleted=true menampilkan semua ─────────
  it("200 — ?include_deleted=true menampilkan live + soft-deleted", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({ name: "Live", createdBy: user.id });
    await seedProduct({
      name: "Deleted",
      createdBy: user.id,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .get(`${productEndpoint}?include_deleted=true`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    const names = res.body.data.items.map((i: any) => i.name).sort();
    expect(names).toEqual(["Deleted", "Live"]);
  });

  // ── Case 9: Varian soft-deleted tidak dihitung ─────────────
  it("200 — variant_count & total_stock hanya menghitung varian aktif (BR-14)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    await seedProduct({
      name: "Kaos",
      createdBy: user.id,
      variants: [
        { sku: "A", price: 10000, stock: 5 }, // aktif
        { sku: "B", price: 10000, stock: 10, deletedAt: new Date() }, // soft-deleted
      ],
    });

    const res = await request(app)
      .get(productEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].variant_count).toBe(1);
    expect(res.body.data.items[0].total_stock).toBe(5);
  });

  // ── Case 10: Hasil kosong → total_pages = 0 ────────────────
  it("200 — hasil kosong: items=[], total_pages=0", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .get(productEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      total_pages: 0,
    });
  });

  // ── Case 11: page=0 ditolak ────────────────────────────────
  it("400 — VALIDATION_ERROR untuk ?page=0", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .get(`${productEndpoint}?page=0`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 12: limit > 100 ditolak ───────────────────────────
  it("400 — VALIDATION_ERROR untuk ?limit=101", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .get(`${productEndpoint}?limit=101`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 13: status tidak valid ────────────────────────────
  it("400 — VALIDATION_ERROR untuk ?status=FOO", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .get(`${productEndpoint}?status=FOO`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 14: Tanpa auth ────────────────────────────────────
  it("401 — UNAUTHORIZED tanpa auth", async () => {
    const res = await request(app).get(productEndpoint);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("403 — FORBIDDEN untuk user non-admin (buyer)", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie(); // helper buyer

    const res = await request(app)
      .get(productEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});
