// src/modules/product/product.delete.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk `DELETE /api/v1/admin/products_v2/:id`.
 *
 * Cakupan:
 *  - BR-27: DRAFT/INACTIVE tetap, ACTIVE → INACTIVE (atomik).
 *  - BR-05: baris tetap ada (soft delete, bukan hard).
 *  - BR-26: updated_by & updated_at terisi dari actor.
 *  - Anti-enumeration: not-found dan double-delete keduanya 404.
 *  - Race concurrent delete: satu 200, satu 404 (atomic WHERE).
 *  - Params UUID, auth wajib.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

interface SeedProductOpts {
  name: string;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  categoryId?: string | null;
  deletedAt?: Date | null;
  createdBy: string;
}

async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      name: opts.name,
      status: opts.status ?? "DRAFT",
      categoryId: opts.categoryId ?? null,
      deletedAt: opts.deletedAt ?? null,
      createdBy: opts.createdBy,
      updatedBy: opts.createdBy,
    },
  });
}

describe("DELETE /api/v1/admin/products_v2/:id", () => {
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

  // ── Case 1: DRAFT → soft delete → DRAFT + deletedAt ─────────
  it("200 — DRAFT di-soft-delete, status tetap DRAFT", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "DRAFT",
      createdBy: user.id,
    });

    const res = await request(app)
      .delete(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product archived successfully");
    expect(res.body.data).toBeNull();

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.deletedAt).not.toBeNull();
    expect(stored!.status).toBe("DRAFT"); // tetap DRAFT (BR-27)
    expect(stored!.updatedBy).toBe(user.id);
  });

  // ── Case 2: ACTIVE → soft delete → INACTIVE + deletedAt ────
  it("200 — ACTIVE di-soft-delete, status otomatis jadi INACTIVE (BR-27)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "ACTIVE",
      categoryId: CATEGORY_ID,
      createdBy: user.id,
    });

    const res = await request(app)
      .delete(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.deletedAt).not.toBeNull();
    expect(stored!.status).toBe("INACTIVE");
    expect(stored!.updatedBy).toBe(user.id);
  });

  // ── Case 3: INACTIVE → soft delete → INACTIVE + deletedAt ──
  it("200 — INACTIVE di-soft-delete, status tetap INACTIVE", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      categoryId: CATEGORY_ID,
      createdBy: user.id,
    });

    const res = await request(app)
      .delete(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
    expect(stored!.deletedAt).not.toBeNull();
  });

  // ── Case 4: BR-05 — baris tetap ada (bukan hard delete) ─────
  it("200 — baris tetap ada di DB setelah delete (BR-05 soft delete)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    await request(app)
      .delete(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored).not.toBeNull();
    expect(stored!.deletedAt).not.toBeNull();
  });

  // ── Case 5: Not found → 404 ──────────────────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk tidak ada", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .delete(`${baseEndpoint}/11111111-1111-4111-8111-999999999999`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 6: Double-delete → 404 (not idempotent) ────────────
  it("404 — double delete: yang kedua dapat PRODUCT_NOT_FOUND (already soft-deleted)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    const first = await request(app)
      .delete(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);
    expect(first.status).toBe(200);

    const second = await request(app)
      .delete(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);
    expect(second.status).toBe(404);
    expect(second.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 7: Race concurrent delete — atomic WHERE ───────────
  it("race — concurrent delete: satu 200, satu 404 (atomic WHERE deletedAt IS NULL)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    // Dua request paralel. Postgres akan serialize via row lock:
    // yang menang commit deletedAt, yang kalah re-evaluate WHERE
    // → deleted_at tidak null → 0 rows → 404.
    const [res1, res2] = await Promise.all([
      request(app)
        .delete(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]),
      request(app)
        .delete(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 404]);

    // Final state tetap soft-deleted (bukan double-write).
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.deletedAt).not.toBeNull();
  });

  // ── Case 8: Params bukan UUID ────────────────────────────────
  it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .delete(`${baseEndpoint}/not-a-uuid`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 9: Tanpa auth ───────────────────────────────────────
  it("401 — UNAUTHORIZED tanpa auth", async () => {
    const res = await request(app).delete(
      `${baseEndpoint}/11111111-1111-4111-8111-111111111111`,
    );

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  // ── Case 10: Integrasi dengan list — soft-deleted hilang ────
  it("integrasi — produk hilang dari list default setelah di-soft-delete", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Akan Dihapus",
      createdBy: user.id,
    });
    await seedProduct({ name: "Tetap Ada", createdBy: user.id });

    await request(app)
      .delete(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie]);

    // List default: exclude soft-deleted.
    const listRes = await request(app)
      .get(baseEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].name).toBe("Tetap Ada");

    // Dengan include_deleted=true: tetap tampil.
    const allRes = await request(app)
      .get(`${baseEndpoint}?include_deleted=true`)
      .set("Cookie", [accessTokenCookie]);

    expect(allRes.status).toBe(200);
    expect(allRes.body.data.items).toHaveLength(2);
  });
});
