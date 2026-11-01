// src/modules/product/product.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookie, getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk `POST /api/v1/admin/products`.
 *
 * Cakupan (bukan logika bisnis — itu wilayah unit test):
 *  - Route terdaftar & middleware terpasang.
 *  - `authenticateAdmin` menolak tanpa header test.
 *  - `validate(createProductSchema)` menimpa `req.body` dan mengembalikan
 *    envelope 400 dengan `data.errors[0].code === "VALIDATION_ERROR"`.
 *  - `asyncHandler` menangkap throw service → envelope 404 untuk
 *    `CATEGORY_NOT_FOUND`.
 *  - FK real di DB (RESTRICT) → 404 (bukan 500) saat kategori fiktif.
 *  - Persistensi: row benar-benar masuk DB dengan `status = DRAFT` dan
 *    `createdBy = adminId`.
 *  - DTO tidak membocorkan field Prisma (camelCase) ke response.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Seed minimal: 1 admin (FK `createdBy`/`updatedBy`) + 1 kategori
 * (FK `categoryId`). Tanpa ini, semua insert akan gagal P2003.
 */
async function seed() {
  await prisma.category.create({
    data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
  });
}

/**
 * Bersihkan DB dengan urutan yang menghormati FK RESTRICT:
 *   Product → Category → User
 * (Product punya FK ke dua lainnya; Category dan User independen).
 */
async function cleanup() {
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

describe("POST /api/v1/admin/products", () => {
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

  const productEndpoint = "/api/v1/admin/products_v2";

  // ── Case 1: Happy path ────────────────────────────────────────
  it("201 — membuat produk dengan kategori & menyimpannya ke DB", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({
        name: "  Kaos Hitam Premium  ", // sengaja dengan spasi untuk cek trim
        description: "Katun combed 30s",
        category_id: CATEGORY_ID,
      });

    // Envelope + status
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product created successfully");

    // DTO: snake_case, tidak bocorkan field Prisma
    expect(res.body.data).toMatchObject({
      name: "Kaos Hitam Premium", // sudah di-trim
      description: "Katun combed 30s",
      category_id: CATEGORY_ID,
      status: "DRAFT",
      created_by: user.id,
    });
    expect(res.body.data).not.toHaveProperty("categoryId");
    expect(res.body.data).not.toHaveProperty("createdBy");
    expect(res.body.data).not.toHaveProperty("createdAt");
    expect(typeof res.body.data.created_at).toBe("string");

    // Persistensi: row benar-benar tersimpan dengan field yang benar.
    const stored = await prisma.product.findUnique({
      where: { id: res.body.data.id },
    });
    expect(stored).not.toBeNull();
    expect(stored!.status).toBe("DRAFT");
    expect(stored!.createdBy).toBe(user.id);
    expect(stored!.updatedBy).toBe(user.id);
    expect(stored!.categoryId).toBe(CATEGORY_ID);
    expect(stored!.deletedAt).toBeNull();
  });

  // ── Case 2: Tanpa kategori (DRAFT boleh) ──────────────────────
  it("201 — membuat DRAFT tanpa kategori", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Topi Baseball" });

    expect(res.status).toBe(201);
    expect(res.body.data.category_id).toBeNull();
    expect(res.body.data.description).toBeNull();
    expect(res.body.data.status).toBe("DRAFT");
  });

  // ── Case 3: Client tidak bisa override status/actor ──────────
  it("201 — mengabaikan `status` & `created_by` dari client (Zod strip)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const ATTACKER_ID = "00000000-0000-0000-0000-00000000ffff";

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({
        name: "Kaos",
        status: "ACTIVE", // harus diabaikan
        created_by: ATTACKER_ID, // harus diabaikan
        updated_by: ATTACKER_ID, // harus diabaikan
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.created_by).toBe(user.id);
  });

  // ── Case 4: Normalisasi description "" → null ────────────────
  it("201 — menormalkan description kosong menjadi null", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Kaos", description: "   " });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBeNull();
  });

  // ── Case 5: name wajib (missing) ─────────────────────────────
  it("400 — VALIDATION_ERROR saat name tidak dikirim", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ category_id: CATEGORY_ID });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.data.errors[0].message).toMatch(/name/i);

    // Tidak ada yang tersimpan.
    expect(await prisma.product.count()).toBe(0);
  });

  // ── Case 6: name whitespace-only ditolak setelah trim ────────
  it("400 — VALIDATION_ERROR saat name hanya whitespace", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(await prisma.product.count()).toBe(0);
  });

  // ── Case 7: category_id bukan UUID ───────────────────────────
  it("400 — VALIDATION_ERROR saat category_id bukan UUID", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Kaos", category_id: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.data.errors[0].message).toMatch(/uuid/i);
  });

  // ── Case 8: Tanpa header auth ────────────────────────────────
  it("401 — UNAUTHORIZED tanpa header x-test-user-id", async () => {
    const res = await request(app).post(productEndpoint).send({ name: "Kaos" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  // ── Case 9: Kategori fiktif — pre-check jalur 404 ────────────
  it("404 — CATEGORY_NOT_FOUND saat kategori tidak ada", async () => {
    const fakeId = "11111111-1111-4111-9111-111111111111";
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Kaos", category_id: fakeId });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
    expect(await prisma.product.count()).toBe(0);
  });

  // ── Case 10: Race path — FK real memicu 404 (bukan 500) ──────

  it("404 — FK violation asli dari DB dipetakan ke CATEGORY_NOT_FOUND (race)", async () => {
    const ghostCategoryId = "11111111-1111-4111-9111-111111111111"; // tidak ada di DB
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    // Pre-check dibuat "lolos" seolah kategori masih ada saat dicek.
    // Insert tetap ke DB asli, jadi error P2003 datang dari Postgres sungguhan.
    const spy = vi
      .spyOn(prisma.category, "findUnique")
      .mockResolvedValueOnce({ id: ghostCategoryId } as any);

    const res = await request(app)
      .post(productEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Kaos", category_id: ghostCategoryId });

    // Pastikan pre-check memang terlewati lewat spy, bukan kembali jadi duplikat Case 9.
    expect(spy).toHaveBeenCalledTimes(2);

    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
    expect(await prisma.product.count()).toBe(0);
  });
});
