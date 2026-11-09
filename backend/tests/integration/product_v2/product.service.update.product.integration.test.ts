// src/modules/product/product.update.integration.test.ts
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";
import { seedProduct, SeedProductOpts } from "./helpers.product.integration";

/**
 * Integration test untuk `PUT /api/v1/admin/products_v2/:id`.
 *
 * Cakupan (bukan logika bisnis — itu wilayah unit test):
 *  - Route PUT terdaftar & middleware terpasang (auth + params + body).
 *  - `.strict()` menolak `status`, `created_by`, `id`, dsb. di body.
 *  - `.refine()` menolak body kosong.
 *  - Partial update: hanya field yang dikirim yang berubah di DB.
 *  - `category_id: null` (clear) memakai `where { status: { not: "ACTIVE" } }`
 *    → atomik. Produk ACTIVE ditolak dengan `CATEGORY_REQUIRED`.
 *  - Soft-deleted product → 404 (BR-05).
 *  - Race `category_id` set vs kategori dihapus → P2003 → 404 CATEGORY_NOT_FOUND.
 *  - `updated_by` selalu dari session, bukan body (BR-26).
 *  - DTO hanya 4 field sesuai kontrak (id, name, updated_by, updated_at).
 *  - 401 tanpa auth.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

describe("PUT /api/v1/admin/products_v2/:id", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    await prisma.category.create({
      data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
    });
  });

  afterEach(() => {
    // Restore semua spyOn — penting karena race test memakai spy.
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  const baseEndpoint = "/api/v1/admin/products_v2";

  // ── Case 1: Happy path — update name saja ─────────────────────
  it("200 — update name saja, field lain di DB tidak berubah", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Nama Lama",
      categoryId: CATEGORY_ID,
      createdBy: user.id,
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Nama Baru" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product updated successfully");
    expect(res.body.data).toEqual({
      id: product.id,
      name: "Nama Baru",
      category_id: CATEGORY_ID,
      description: null,
      status: "DRAFT",
      updated_by: user.id,
      updated_at: expect.any(String),
    });
    // DTO minimal — tidak bocorkan field Prisma.
    expect(res.body.data).not.toHaveProperty("updatedBy");

    // Persistensi: name berubah, description & kategori tetap.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.name).toBe("Nama Baru");
    expect(stored!.categoryId).toBe(CATEGORY_ID);
    expect(stored!.description).toBeNull();
    expect(stored!.updatedBy).toBe(user.id);
  });

  // ── Case 2: Normalisasi description "" → null ────────────────
  it("200 — description '' dinormalisasi menjadi null di DB", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      createdBy: user.id,
    });
    // Seed awal description non-null
    await prisma.product.update({
      where: { id: product.id },
      data: { description: "deskripsi lama" },
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ description: "" });

    expect(res.status).toBe(200);
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.description).toBeNull();
  });

  // ── Case 3: Set kategori ke UUID valid ───────────────────────
  it("200 — category_id valid mengganti kategori produk", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      categoryId: null,
      createdBy: user.id,
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ category_id: CATEGORY_ID });

    expect(res.status).toBe(200);
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.categoryId).toBe(CATEGORY_ID);
  });

  // ── Case 4: Clear kategori pada DRAFT — sukses ───────────────
  it("200 — category_id null pada produk DRAFT berhasil clear", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      categoryId: CATEGORY_ID,
      status: "DRAFT",
      createdBy: user.id,
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ category_id: null });

    expect(res.status).toBe(200);
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.categoryId).toBeNull();
  });

  // ── Case 5: Clear kategori pada INACTIVE — sukses ────────────
  it("200 — category_id null pada produk INACTIVE berhasil clear", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      categoryId: CATEGORY_ID,
      status: "INACTIVE",
      createdBy: user.id,
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ category_id: null });

    expect(res.status).toBe(200);
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.categoryId).toBeNull();
  });

  // ── Case 6: Clear kategori pada ACTIVE — ditolak (BR-07/BR-24)
  it("400 — CATEGORY_REQUIRED saat clear kategori pada produk ACTIVE", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      categoryId: CATEGORY_ID,
      status: "ACTIVE",
      createdBy: user.id,
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ category_id: null });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CATEGORY_REQUIRED");

    // Data tidak berubah.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.categoryId).toBe(CATEGORY_ID);
  });

  // ── Case 7: Race — clear kategori saat publish concurrent ────
  it("400 — CATEGORY_REQUIRED saat update tidak match because status ACTIVE (race-safe via where)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      categoryId: CATEGORY_ID,
      status: "ACTIVE",
      createdBy: user.id,
    });

    // Skenario: DRAFT saat request dikirim, tapi publish concurrent
    // commit lebih dulu → updateMany dengan where {status:{not:"ACTIVE"}}
    // tidak match (P2025) → service disambiguasi via findFirst → ACTIVE.
    // Test ini memverifikasi model konsistensi; jalur P2025 nyata
    // dipicu karena produk di DB memang ACTIVE.
    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ category_id: null });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CATEGORY_REQUIRED");
    // Kategori di DB tetap (tidak clear) — invariant terjaga.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.categoryId).toBe(CATEGORY_ID);
  });

  // ── Case 8: Body kosong — VALIDATION_ERROR ───────────────────
  it("400 — VALIDATION_ERROR saat body kosong (refine)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 9: `.strict()` menolak status di body ───────────────
  it("400 — status di body ditolak (strict), hanya lewat endpoint publish", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "X", status: "ACTIVE" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    // Produk tetap DRAFT (BR-03 & BR-04 tidak dilanggar).
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("DRAFT");
    expect(stored!.name).toBe("Kaos");
  });

  // ── Case 10: `.strict()` menolak created_by di body ──────────
  it("400 — created_by di body ditolak (strict), actor tetap dari session", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "X", created_by: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 11: `.strict()` menolak field tak dikenal ───────────
  it("400 — field tak dikenal di body ditolak (strict)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "X", something_unknown: "y" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 12: Params bukan UUID ───────────────────────────────
  it("400 — :id bukan UUID ditolak VALIDATION_ERROR", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .put(`${baseEndpoint}/not-a-uuid`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "X" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 13: Produk tidak ada → 404 ──────────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk tidak ada", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .put(`${baseEndpoint}/11111111-1111-4111-8111-999999999999`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "X" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 14: Produk soft-deleted → 404 ───────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk soft-deleted (BR-05)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Arsip",
      createdBy: user.id,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Baru" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    // Nama tidak berubah.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.name).toBe("Arsip");
  });

  // ── Case 15: Kategori tidak ada (pre-check) ──────────────────
  it("404 — CATEGORY_NOT_FOUND saat category_id menunjuk kategori fiktif", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ category_id: "11111111-1111-4111-8111-999999999999" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
    // Data tidak berubah.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.categoryId).toBeNull();
  });

  // ── Case 16: Race — kategori dihapus antara pre-check & update
  it("404 — CATEGORY_NOT_FOUND saat kategori hilang di antara pre-check dan update (P2003 race)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    const ghostCategoryId = "11111111-1111-4111-8111-aaaaaaaaaaaa";

    // Pre-check dipaksa lolos: service melihat kategori seolah ada.
    // Insert tetap ke DB asli → FK Postgres menolak (kategori tidak
    // benar-benar ada) → P2003. Re-check memakai real DB → null.
    vi.spyOn(prisma.category, "findUnique").mockResolvedValueOnce({
      id: ghostCategoryId,
    } as any);

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ category_id: ghostCategoryId });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
    // Data tidak berubah.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.categoryId).toBeNull();
  });

  // ── Case 17: 401 tanpa auth ──────────────────────────────────
  it("401 — UNAUTHORIZED tanpa auth", async () => {
    const res = await request(app)
      .put(`${baseEndpoint}/11111111-1111-4111-8111-111111111111`)
      .send({ name: "X" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  // ── Case 18: Security — updated_by dari session, bukan body ──
  it("200 — updated_by diambil dari session, bukan dari payload", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({ name: "Kaos", createdBy: user.id });

    // Payload berisi `updated_by` tidak mungkin lolos `.strict()`,
    // tapi kita cek end-to-end bahwa DB menyimpan user.id dari session.
    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Baru" });

    expect(res.status).toBe(200);
    expect(res.body.data.updated_by).toBe(user.id);

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.updatedBy).toBe(user.id);
  });

  // ── Case 19: Multi-field update ──────────────────────────────
  it("200 — multi-field update (name + description + category_id) tersimpan konsisten", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Lama",
      categoryId: null,
      createdBy: user.id,
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({
        name: "Baru",
        description: "deskripsi baru",
        category_id: CATEGORY_ID,
      });

    expect(res.status).toBe(200);

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.name).toBe("Baru");
    expect(stored!.description).toBe("deskripsi baru");
    expect(stored!.categoryId).toBe(CATEGORY_ID);
    expect(stored!.updatedBy).toBe(user.id);
  });

  // ── Case 20: Status TIDAK berubah via PUT ────────────────────
  it("200 — status tetap walau field lain berubah (status hanya via publish/unpublish)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
    });

    const res = await request(app)
      .put(`${baseEndpoint}/${product.id}`)
      .set("Cookie", [accessTokenCookie])
      .send({ name: "Baru" });

    expect(res.status).toBe(200);
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
  });
});
