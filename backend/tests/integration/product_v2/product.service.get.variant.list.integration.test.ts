// tests/integration-test/product_v2/product.list-variants.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk `GET /api/v1/admin/products_v2/:id/variants`.
 *
 * Cakupan:
 *  - Default: hanya varian aktif, DTO lengkap (snake_case, price number,
 *    low_stock derived, deleted_at null).
 *  - `include_deleted=true` → varian soft-deleted ikut tampil dengan
 *    deleted_at ISO string (BR-14 override).
 *  - `low_stock=true` → filter `stock < 5` (BR-23), boundary stock=5
 *    TIDAK ikut.
 *  - Kombinasi `include_deleted` & `low_stock` — intersection.
 *  - Produk kosong → `items: []` (200, bukan 404).
 *  - Produk not-found / soft-deleted → 404 PRODUCT_NOT_FOUND
 *    (anti-enumeration, BR-05).
 *  - Params bukan UUID / query flag invalid → 400 VALIDATION_ERROR.
 *  - Auth 401.
 *  - Order deterministik: createdAt asc + id asc tiebreaker.
 *  - Security: DTO tidak bocorkan createdBy/updatedBy/productId.
 *  - Cross-endpoint: soft-delete variant via API → hilang dari list;
 *    create variant via API → muncul di list.
 *
 * Format error (Opsi B): `{ status: "error", code, message }` — single-error.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const baseEndpoint = "/api/v1/admin/products_v2";

// ── Seed helpers ───────────────────────────────────────────────────

async function seedProduct(opts: {
  name?: string;
  createdBy: string;
  deletedAt?: Date | null;
}) {
  return prisma.product.create({
    data: {
      name: opts.name ?? "Kaos",
      status: "DRAFT",
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
  createdAt?: Date;
  id?: string;
  createdBy: string;
}

/**
 * Seed variant via Prisma (bypass API) — untuk menyiapkan state
 * "soft-deleted" yang tidak bisa dibentuk lewat endpoint create.
 */
async function seedVariant(opts: SeedVariantOpts) {
  return prisma.productVariant.create({
    data: {
      ...(opts.id ? { id: opts.id } : {}),
      productId: opts.productId,
      sku: opts.sku,
      // Default size = sku → kombinasi (size, color) unik per variant.
      // Kalau caller mau test kombinasi tertentu, pass `size` eksplisit.
      size: opts.size === undefined ? opts.sku : opts.size,
      color: opts.color === undefined ? null : opts.color,
      price: opts.price ?? 100000,
      stock: opts.stock ?? 10,
      deletedAt: opts.deletedAt ?? null,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      createdBy: opts.createdBy,
      updatedBy: opts.createdBy,
    },
  });
}

// ── Test suite ─────────────────────────────────────────────────────

describe("GET /api/v1/admin/products_v2/:id/variants", () => {
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
  // Group 1 — Happy paths
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths", () => {
    it("200 — default: hanya varian aktif, DTO lengkap (snake_case, low_stock derived)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      await seedVariant({
        productId: product.id,
        sku: "KAOS-L",
        size: "L",
        color: "Hitam",
        price: 100000,
        stock: 20,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "KAOS-M",
        size: "M",
        color: "Hitam",
        price: 100000,
        stock: 3, // low_stock=true
        createdBy: user.id,
      });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Variants retrieved successfully");
      expect(res.body.data.items).toHaveLength(2);

      const l = res.body.data.items.find((v: any) => v.sku === "KAOS-L");
      const m = res.body.data.items.find((v: any) => v.sku === "KAOS-M");

      expect(l).toMatchObject({
        size: "L",
        color: "Hitam",
        price: 100000,
        stock: 20,
        low_stock: false,
        deleted_at: null,
      });
      expect(m).toMatchObject({
        size: "M",
        stock: 3,
        low_stock: true,
        deleted_at: null,
      });
      // price dikonversi ke number (bukan Decimal string).
      expect(typeof l.price).toBe("number");
    });

    it("200 — produk tanpa varian: items kosong (bukan 404)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — include_deleted filter
  // ═══════════════════════════════════════════════════════════════
  describe("include_deleted filter", () => {
    it("default (false) — varian soft-deleted disembunyikan (BR-14)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      await seedVariant({
        productId: product.id,
        sku: "LIVE",
        stock: 10,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "DELETED",
        stock: 5,
        deletedAt: new Date("2026-01-01T00:00:00Z"),
        createdBy: user.id,
      });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].sku).toBe("LIVE");
    });

    it("include_deleted=true — varian soft-deleted tampil dengan deleted_at ISO string", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const deletedAt = new Date("2026-01-15T10:00:00.000Z");

      await seedVariant({
        productId: product.id,
        sku: "LIVE",
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "DELETED",
        deletedAt,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants?include_deleted=true`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);

      const deleted = res.body.data.items.find((v: any) => v.sku === "DELETED");
      const live = res.body.data.items.find((v: any) => v.sku === "LIVE");

      // deleted_at: ISO string untuk yang soft-deleted, null untuk aktif.
      expect(deleted.deleted_at).toBe(deletedAt.toISOString());
      expect(live.deleted_at).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — low_stock filter
  // ═══════════════════════════════════════════════════════════════
  describe("low_stock filter (BR-23)", () => {
    it("low_stock=true — hanya varian dengan stock < 5 (boundary stock=5 TIDAK ikut)", async () => {
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
        .get(`${baseEndpoint}/${product.id}/variants?low_stock=true`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      const skus = res.body.data.items.map((v: any) => v.sku).sort();
      expect(skus).toEqual(["S-0", "S-3", "S-4"]);
    });

    it("default (low_stock=false) — semua varian aktif ditampilkan tanpa filter stock", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      await seedVariant({
        productId: product.id,
        sku: "S-3",
        stock: 3,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "S-10",
        stock: 10,
        createdBy: user.id,
      });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Kombinasi filter
  // ═══════════════════════════════════════════════════════════════
  describe("kombinasi include_deleted + low_stock", () => {
    it("include_deleted=true & low_stock=true — semua varian low-stock termasuk yang soft-deleted", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // 4 kombinasi untuk membuktikan intersection:
      await seedVariant({
        productId: product.id,
        sku: "ACTIVE-LOW",
        stock: 3,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "ACTIVE-HIGH",
        stock: 10,
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "DELETED-LOW",
        stock: 2,
        deletedAt: new Date(),
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "DELETED-HIGH",
        stock: 20,
        deletedAt: new Date(),
        createdBy: user.id,
      });

      const res = await request(app)
        .get(
          `${baseEndpoint}/${product.id}/variants?include_deleted=true&low_stock=true`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      const skus = res.body.data.items.map((v: any) => v.sku).sort();
      // Intersection: stock < 5, terlepas deleted status.
      expect(skus).toEqual(["ACTIVE-LOW", "DELETED-LOW"]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Product state (not found / soft-deleted)
  // ═══════════════════════════════════════════════════════════════
  describe("product state", () => {
    it("404 — PRODUCT_NOT_FOUND saat produk tidak ada", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .get(`${baseEndpoint}/11111111-1111-4111-8111-999999999999/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("404 — PRODUCT_NOT_FOUND saat produk soft-deleted (BR-05, audit view via detail endpoint)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        createdBy: user.id,
        deletedAt: new Date(),
      });
      // Seed varian aktif — tidak boleh muncul (parent soft-deleted).
      await seedVariant({
        productId: product.id,
        sku: "ORPHAN",
        createdBy: user.id,
      });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      // 404 — bukan 200 dengan items kosong. Product soft-deleted
      // diperlakukan seolah tidak ada (konsisten dengan getById).
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Validasi input
  // ═══════════════════════════════════════════════════════════════
  describe("validasi input", () => {
    it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .get(`${baseEndpoint}/not-a-uuid/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat include_deleted bukan 'true'/'false'", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants?include_deleted=1`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat low_stock=yes (bukan boolean string)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants?low_stock=yes`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app).get(
        `${baseEndpoint}/11111111-1111-4111-8111-111111111111/variants`,
      );

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Security (DTO leak)
  // ═══════════════════════════════════════════════════════════════
  describe("security — DTO tidak bocorkan field internal", () => {
    it("item tidak memuat createdBy/updatedBy/productId (select subset)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      await seedVariant({
        productId: product.id,
        sku: "SEC",
        createdBy: user.id,
      });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      const item = res.body.data.items[0];

      // Field internal Prisma tidak boleh bocor.
      expect(item).not.toHaveProperty("createdBy");
      expect(item).not.toHaveProperty("updatedBy");
      expect(item).not.toHaveProperty("productId");
      expect(item).not.toHaveProperty("createdAt");
      expect(item).not.toHaveProperty("updatedAt");
      expect(item).not.toHaveProperty("deletedAt"); // harusnya snake_case

      // Field yang WAJIB ada di DTO.
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("sku");
      expect(item).toHaveProperty("size");
      expect(item).toHaveProperty("color");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("stock");
      expect(item).toHaveProperty("low_stock");
      expect(item).toHaveProperty("deleted_at");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 8 — Cross-endpoint
  // ═══════════════════════════════════════════════════════════════
  describe("cross-endpoint", () => {
    it("create variant via API → muncul di list default", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Sebelum create: kosong.
      const before = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);
      expect(before.body.data.items).toEqual([]);

      // Create via API.
      const createRes = await request(app)
        .post(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie])
        .send({ sku: "NEW-SKU", size: "L", price: 50000, stock: 10 });
      expect(createRes.status).toBe(201);

      // Sesudah create: 1 item.
      const after = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);
      expect(after.body.data.items).toHaveLength(1);
      expect(after.body.data.items[0].sku).toBe("NEW-SKU");
    });

    it("soft-deleted variant hilang dari list default, tapi muncul dengan include_deleted=true", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      await seedVariant({
        productId: product.id,
        sku: "TO-DELETE",
        createdBy: user.id,
      });

      // Soft-delete via Prisma (endpoint DELETE variant belum ada di test ini).
      // Yang penting: state consistency dengan filter list.
      await prisma.productVariant.update({
        where: { sku: "TO-DELETE" },
        data: { deletedAt: new Date() },
      });

      // Default: hilang.
      const defaultRes = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);
      expect(defaultRes.body.data.items).toEqual([]);

      // include_deleted=true: muncul.
      const allRes = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants?include_deleted=true`)
        .set("Cookie", [accessTokenCookie]);
      expect(allRes.body.data.items).toHaveLength(1);
      expect(allRes.body.data.items[0].sku).toBe("TO-DELETE");
      expect(allRes.body.data.items[0].deleted_at).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 9 — Order stability (createdAt asc + id asc tiebreaker)
  // ═══════════════════════════════════════════════════════════════
  describe("order deterministik", () => {
    it("urutan by createdAt asc, tiebreaker id asc saat createdAt sama", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Dua varian dengan createdAt IDENTIK — harus diurutkan by id asc.
      await seedVariant({
        id: "00000000-0000-4000-8000-000000000001",
        productId: product.id,
        sku: "FIRST-BY-ID",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        createdBy: user.id,
      });
      await seedVariant({
        id: "00000000-0000-4000-8000-000000000002",
        productId: product.id,
        sku: "SECOND-BY-ID",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        createdBy: user.id,
      });

      // Varian dengan createdAt lebih baru — harus muncul setelah dua di atas.
      await seedVariant({
        id: "00000000-0000-4000-8000-000000000003",
        productId: product.id,
        sku: "LATEST",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        createdBy: user.id,
      });

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items.map((v: any) => v.sku)).toEqual([
        "FIRST-BY-ID",
        "SECOND-BY-ID",
        "LATEST",
      ]);
    });

    it("urutan konsisten antar request (tidak flipping)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      for (let i = 1; i <= 3; i++) {
        await seedVariant({
          id: `00000000-0000-4000-8000-00000000000${i}`,
          productId: product.id,
          sku: `SKU-${i}`,
          createdAt: new Date("2026-01-01T00:00:00.000Z"), // sama persis
          createdBy: user.id,
        });
      }

      const fetch = () =>
        request(app)
          .get(`${baseEndpoint}/${product.id}/variants`)
          .set("Cookie", [accessTokenCookie]);

      const [r1, r2, r3] = await Promise.all([fetch(), fetch(), fetch()]);
      const skus1 = r1.body.data.items.map((v: any) => v.sku);
      const skus2 = r2.body.data.items.map((v: any) => v.sku);
      const skus3 = r3.body.data.items.map((v: any) => v.sku);

      // Order konsisten antar concurrent request — berkat tiebreaker id asc.
      expect(skus1).toEqual(skus2);
      expect(skus2).toEqual(skus3);
      expect(skus1).toEqual(["SKU-1", "SKU-2", "SKU-3"]);
    });
  });
});
