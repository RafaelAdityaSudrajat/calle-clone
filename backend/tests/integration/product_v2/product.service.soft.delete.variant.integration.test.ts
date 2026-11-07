// tests/integration-test/product_v2/product.delete-variant.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk
 * `DELETE /api/v1/admin/products_v2/:id/variants/:variantId`.
 *
 * Cakupan:
 *  - Soft delete (BR-14): baris tetap ada, deletedAt terisi.
 *  - BR-27: varian terakhir di-soft-delete + produk ACTIVE → INACTIVE.
 *  - BR-27: varian terakhir di-soft-delete + produk DRAFT / INACTIVE → status tetap.
 *  - Varian bukan terakhir → produk status tetap.
 *  - Product not-found / soft-deleted → 404 PRODUCT_NOT_FOUND.
 *  - Variant not-found / soft-deleted / milik produk lain (IDOR) → 404 VARIANT_NOT_FOUND.
 *  - Params UUID, auth 401.
 *  - Race concurrent delete 2 varian terakhir → state akhir 0 varian + INACTIVE.
 *  - Race concurrent delete variant sama → satu 200, satu 404.
 *  - Cross-endpoint: delete variant → hilang dari list default.
 *  - Cross-endpoint: delete variant terakhir pada ACTIVE → GET product status INACTIVE.
 *  - Cross-endpoint: delete variant terakhir → publish gagal PRODUCT_NEEDS_VARIANT.
 *  - Security: updated_by dari session.
 *
 * Format error (Opsi B): `{ status: "error", code, message }` — single-error.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const baseEndpoint = "/api/v1/admin/products_v2";

// ── Seed helpers ───────────────────────────────────────────────────

interface SeedProductOpts {
  name?: string;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  categoryId?: string | null;
  deletedAt?: Date | null;
  createdBy: string;
}

async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      name: opts.name ?? "Kaos",
      status: opts.status ?? "DRAFT",
      categoryId: opts.categoryId === undefined ? CATEGORY_ID : opts.categoryId,
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
 * Seed variant via Prisma (bypass API). Default size = sku supaya
 * kombinasi (size, color) unik per produk — mencegah collision
 * partial unique index saat seed multiple variants.
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

describe("DELETE /api/v1/admin/products_v2/:id/variants/:variantId", () => {
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
    it("200 — soft delete variant (BR-14): baris tetap ada, deletedAt terisi, updatedBy dari session", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });

      const v1 = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "V2",
        createdBy: user.id,
      });

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v1.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Variant deleted successfully");
      expect(res.body.data).toBeNull();

      // BR-14: baris TETAP ADA (soft delete), deletedAt terisi.
      const stored = await prisma.productVariant.findUnique({
        where: { id: v1.id },
      });
      expect(stored).not.toBeNull();
      expect(stored!.deletedAt).not.toBeNull();
      expect(stored!.updatedBy).toBe(user.id);

      // Varian lain tidak tersentuh.
      const other = await prisma.productVariant.findFirst({
        where: { sku: "V2" },
      });
      expect(other!.deletedAt).toBeNull();
    });

    it("200 — varian bukan terakhir: produk tetap ACTIVE (BR-27 tidak trigger)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });

      const v1 = await seedVariant({
        productId: product.id,
        sku: "V1",
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "V2",
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v1.id}`)
        .set("Cookie", [accessTokenCookie]);

      const stored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stored!.status).toBe("ACTIVE");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — BR-27: auto-INACTIVE saat varian terakhir
  // ═══════════════════════════════════════════════════════════════
  describe("BR-27 — auto-INACTIVE saat varian terakhir di-soft-delete", () => {
    it("ACTIVE + varian terakhir → produk otomatis INACTIVE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "ONLY",
        createdBy: user.id,
      });

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);

      const stored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stored!.status).toBe("INACTIVE");
      expect(stored!.updatedBy).toBe(user.id);
    });

    it("INACTIVE + varian terakhir → status tetap INACTIVE (tidak berubah)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "INACTIVE",
        createdBy: user.id,
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "ONLY",
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      const stored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stored!.status).toBe("INACTIVE");
    });

    it("DRAFT + varian terakhir → tetap DRAFT (BR-27 hanya ubah ACTIVE→INACTIVE)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "DRAFT",
        createdBy: user.id,
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "ONLY",
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      const stored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stored!.status).toBe("DRAFT");
    });

    it("ACTIVE + 2 varian (sudah ada 1 soft-deleted) → delete varian aktif terakhir → INACTIVE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });

      // Satu varian aktif, satu sudah soft-deleted.
      const live = await seedVariant({
        productId: product.id,
        sku: "LIVE",
        createdBy: user.id,
      });
      await seedVariant({
        productId: product.id,
        sku: "DELETED",
        deletedAt: new Date(),
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${live.id}`)
        .set("Cookie", [accessTokenCookie]);

      // Count varian aktif = 0 (varian soft-deleted tidak dihitung) → BR-27 trigger.
      const stored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stored!.status).toBe("INACTIVE");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Product not found
  // ═══════════════════════════════════════════════════════════════
  describe("product not found", () => {
    it("404 — PRODUCT_NOT_FOUND saat produk tidak ada", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .delete(
          `${baseEndpoint}/11111111-1111-4111-8111-999999999999/variants/22222222-2222-4222-8222-999999999999`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("404 — PRODUCT_NOT_FOUND saat produk soft-deleted (BR-05)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        createdBy: user.id,
        deletedAt: new Date(),
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "ORPHAN",
        createdBy: user.id,
      });

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");

      // Variant tidak tersentuh (produk soft-deleted, request ditolak di lock product).
      const stored = await prisma.productVariant.findUnique({
        where: { id: v.id },
      });
      expect(stored!.deletedAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Variant not found / IDOR / soft-deleted
  // ═══════════════════════════════════════════════════════════════
  describe("variant not found / IDOR / soft-deleted", () => {
    it("404 — VARIANT_NOT_FOUND saat variant tidak ada", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .delete(
          `${baseEndpoint}/${product.id}/variants/22222222-2222-4222-8222-999999999999`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");
    });

    it("404 — VARIANT_NOT_FOUND saat variant sudah soft-deleted (anti double-delete)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "ALREADY-DELETED",
        deletedAt: new Date(),
        createdBy: user.id,
      });

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");
    });

    it("404 — VARIANT_NOT_FOUND saat variant milik produk LAIN (IDOR)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const productA = await seedProduct({ name: "A", createdBy: user.id });
      const productB = await seedProduct({ name: "B", createdBy: user.id });

      // Variant milik product B.
      const vB = await seedVariant({
        productId: productB.id,
        sku: "B-VARIANT",
        createdBy: user.id,
      });

      // Request lewat product A → IDOR attempt.
      const res = await request(app)
        .delete(`${baseEndpoint}/${productA.id}/variants/${vB.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      // Anti-enumeration: tidak bisa dibedakan dari "variant tidak ada".
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");

      // Variant milik product B TIDAK tersentuh.
      const stored = await prisma.productVariant.findUnique({
        where: { id: vB.id },
      });
      expect(stored!.deletedAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Validasi input
  // ═══════════════════════════════════════════════════════════════
  describe("validasi input", () => {
    it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .delete(
          `${baseEndpoint}/not-a-uuid/variants/22222222-2222-4222-8222-222222222222`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat :variantId bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .delete(
          `${baseEndpoint}/11111111-1111-4111-8111-111111111111/variants/not-a-uuid`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app).delete(
        `${baseEndpoint}/11111111-1111-4111-8111-111111111111/variants/22222222-2222-4222-8222-222222222222`,
      );

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Race conditions (real concurrency)
  // ═══════════════════════════════════════════════════════════════
  describe("race conditions (real concurrency)", () => {
    it("race — concurrent delete 2 varian terakhir: state akhir 0 varian + product INACTIVE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });

      const v1 = await seedVariant({
        productId: product.id,
        sku: "RACE-1",
        createdBy: user.id,
      });
      const v2 = await seedVariant({
        productId: product.id,
        sku: "RACE-2",
        createdBy: user.id,
      });

      // Dua delete concurrent — dua varian terakhir dari produk ACTIVE.
      // Product FOR UPDATE serialize keduanya:
      //  - T1 lock product, delete v1, count=1 (v2 masih aktif), skip BR-27.
      //  - T2 lock product (setelah T1 release), delete v2, count=0 → INACTIVE.
      // Final: 0 varian aktif + INACTIVE.
      const [res1, res2] = await Promise.all([
        request(app)
          .delete(`${baseEndpoint}/${product.id}/variants/${v1.id}`)
          .set("Cookie", [accessTokenCookie]),
        request(app)
          .delete(`${baseEndpoint}/${product.id}/variants/${v2.id}`)
          .set("Cookie", [accessTokenCookie]),
      ]);

      // Keduanya sukses (bukan race yang salah satu harus gagal —
      // ini dua varian berbeda).
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Final invariant: 0 varian aktif + produk INACTIVE.
      const active = await prisma.productVariant.count({
        where: { productId: product.id, deletedAt: null },
      });
      expect(active).toBe(0);

      const stored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stored!.status).toBe("INACTIVE");
    });

    it("race — concurrent delete variant SAMA: satu 200, satu 404 (double-delete)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "DOUBLE",
        createdBy: user.id,
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
          .set("Cookie", [accessTokenCookie]),
        request(app)
          .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
          .set("Cookie", [accessTokenCookie]),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 404]);

      const loser = res1.status === 404 ? res1 : res2;
      expect(loser.body.code).toBe("VARIANT_NOT_FOUND");

      // Final state: variant soft-deleted, product INACTIVE (BR-27 karena
      // varian ini satu-satunya).
      const stored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stored!.status).toBe("INACTIVE");
    });

    it("race — concurrent delete variant + product soft-delete: salah satu menang, state konsisten", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "CONCURRENT",
        createdBy: user.id,
      });

      const [deleteVariantRes, deleteProductRes] = await Promise.all([
        request(app)
          .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
          .set("Cookie", [accessTokenCookie]),
        request(app)
          .delete(`${baseEndpoint}/${product.id}`)
          .set("Cookie", [accessTokenCookie]),
      ]);

      // Product delete selalu 200 (product ACTIVE → soft-delete → INACTIVE + deletedAt).
      expect(deleteProductRes.status).toBe(200);

      // Variant delete: 200 (menang lock) atau 404 (product sudah soft-deleted).
      expect([200, 404]).toContain(deleteVariantRes.status);

      // Final state konsisten: product selalu soft-deleted + INACTIVE.
      const productStored = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(productStored!.deletedAt).not.toBeNull();
      expect(productStored!.status).toBe("INACTIVE");

      // Kalau variant delete = 404, variant TIDAK tersentuh.
      if (deleteVariantRes.status === 404) {
        const variantStored = await prisma.productVariant.findUnique({
          where: { id: v.id },
        });
        expect(variantStored!.deletedAt).toBeNull();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Cross-endpoint
  // ═══════════════════════════════════════════════════════════════
  describe("cross-endpoint", () => {
    it("delete variant → hilang dari list default, tampil dengan include_deleted=true", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const v = await seedVariant({
        productId: product.id,
        sku: "CROSS-LIST",
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      // Default: hilang.
      const defaultRes = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants`)
        .set("Cookie", [accessTokenCookie]);
      expect(defaultRes.body.data.items).toEqual([]);

      // include_deleted=true: muncul dengan deleted_at terisi.
      const allRes = await request(app)
        .get(`${baseEndpoint}/${product.id}/variants?include_deleted=true`)
        .set("Cookie", [accessTokenCookie]);
      expect(allRes.body.data.items).toHaveLength(1);
      expect(allRes.body.data.items[0].deleted_at).not.toBeNull();
    });

    it("delete varian terakhir pada ACTIVE → GET product detail: status INACTIVE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });
      const v = await seedVariant({
        productId: product.id,
        sku: "ONLY",
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      const res = await request(app)
        .get(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("INACTIVE");
    });

    it("delete varian terakhir → publish gagal PRODUCT_NEEDS_VARIANT (validasi BR-07)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Seed variant + image supaya publish semula bisa lolos.
      const v = await seedVariant({
        productId: product.id,
        sku: "ONLY",
        createdBy: user.id,
      });
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: "https://img/a.png",
          fileKey: "key-a",
          isPrimary: true,
          createdBy: user.id,
        },
      });

      // Delete varian terakhir (masih DRAFT, tidak trigger BR-27).
      await request(app)
        .delete(`${baseEndpoint}/${product.id}/variants/${v.id}`)
        .set("Cookie", [accessTokenCookie]);

      // Publish berikutnya harus gagal karena 0 varian aktif.
      const publishRes = await request(app)
        .post(`${baseEndpoint}/${product.id}/publish`)
        .set("Cookie", [accessTokenCookie]);

      expect(publishRes.status).toBe(400);
      // Multi-error format: `data` array (format project).
      expect(Array.isArray(publishRes.body.data)).toBe(true);
      const codes = (publishRes.body.data as Array<{ code: string }>).map(
        (e) => e.code,
      );
      expect(codes).toContain("PRODUCT_NEEDS_VARIANT");
    });
  });
});
