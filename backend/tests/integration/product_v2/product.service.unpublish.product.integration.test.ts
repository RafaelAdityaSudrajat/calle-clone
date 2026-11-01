// tests/integration-test/product_v2/product.unpublish.integration.test.ts
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

/**
 * Integration test untuk `POST /api/v1/admin/products_v2/:id/unpublish`.
 *
 * Cakupan:
 *  - Transisi ACTIVE → INACTIVE tersimpan di DB (BR-04).
 *  - DRAFT / INACTIVE → 400 INVALID_STATUS_TRANSITION (BR-04).
 *  - Not-found & soft-deleted → 404 PRODUCT_NOT_FOUND (anti-enumeration).
 *  - Race concurrent unpublish: satu 200, satu 400 (WHERE status=ACTIVE atomik).
 *  - Race unpublish vs soft-delete: 1 menang.
 *  - Security: updated_by dari session, bukan payload.
 *  - Cross-endpoint: publish → unpublish → status konsisten.
 *  - Params UUID, auth 401.
 *
 * Format error (Opsi B, sesuai project existing):
 *  - `{ status: "error", code, message }` — single-error, tidak ada `success`.
 *  - Endpoint ini TIDAK punya multi-error (tidak ada validasi BR-07).
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const baseEndpoint = "/api/v1/admin/products_v2";

// ── Seed helper ────────────────────────────────────────────────────

interface SeedProductOpts {
  name: string;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  categoryId?: string | null;
  deletedAt?: Date | null;
  createdBy: string;
}

/**
 * Seed satu produk minimal. Varian & gambar tidak wajib untuk
 * unpublish — endpoint ini hanya transisi status, tidak validasi BR-07.
 */
async function seedProduct(opts: SeedProductOpts) {
  return prisma.product.create({
    data: {
      name: opts.name,
      status: opts.status ?? "DRAFT",
      categoryId: opts.categoryId === undefined ? CATEGORY_ID : opts.categoryId,
      deletedAt: opts.deletedAt ?? null,
      createdBy: opts.createdBy,
      updatedBy: opts.createdBy,
    },
  });
}

// ── Test suite ─────────────────────────────────────────────────────

describe("POST /api/v1/admin/products_v2/:id/unpublish", () => {
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

  // ── Case 1: Happy path ACTIVE → INACTIVE ────────────────────
  it("200 — ACTIVE berhasil unpublish, status & updated_by tersimpan di DB", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "ACTIVE",
      createdBy: user.id,
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/unpublish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product unpublished successfully");
    expect(res.body.data).toEqual({ id: product.id, status: "INACTIVE" });

    // Persistensi: status & updatedBy benar-benar berubah.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
    expect(stored!.updatedBy).toBe(user.id);
    // Soft-delete columns TIDAK tersentuh.
    expect(stored!.deletedAt).toBeNull();
  });

  // ── Case 2: DRAFT → INVALID_STATUS_TRANSITION ───────────────
  it("400 — produk DRAFT ditolak INVALID_STATUS_TRANSITION (BR-04)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "DRAFT",
      createdBy: user.id,
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/unpublish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
    expect(res.body.message).toMatch(/DRAFT/);
    expect(res.body.message).toMatch(/INACTIVE/);

    // Tidak ada write.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("DRAFT");
  });

  // ── Case 3: INACTIVE → INVALID_STATUS_TRANSITION ────────────
  it("400 — produk INACTIVE ditolak INVALID_STATUS_TRANSITION (bukan transisi sah)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "INACTIVE",
      createdBy: user.id,
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/unpublish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
  });

  // ── Case 4: Not found ────────────────────────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk tidak ada", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(`${baseEndpoint}/11111111-1111-4111-8111-999999999999/unpublish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  // ── Case 5: Soft-deleted → 404 (BR-05) ──────────────────────
  it("404 — PRODUCT_NOT_FOUND saat produk soft-deleted (anti-enumeration)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Arsip",
      status: "ACTIVE",
      createdBy: user.id,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .post(`${baseEndpoint}/${product.id}/unpublish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");

    // Status tidak berubah — tidak menyentuh produk soft-deleted.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("ACTIVE");
  });

  // ── Case 6: Params bukan UUID ────────────────────────────────
  it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
    const { accessTokenCookie } = await getAccesTokenCookieAdmin();

    const res = await request(app)
      .post(`${baseEndpoint}/not-a-uuid/unpublish`)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // ── Case 7: Tanpa auth ───────────────────────────────────────
  it("401 — UNAUTHORIZED tanpa auth", async () => {
    const res = await request(app).post(
      `${baseEndpoint}/11111111-1111-4111-8111-111111111111/unpublish`,
    );

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  // ── Case 8: Race concurrent unpublish ───────────────────────
  it("race — concurrent unpublish: satu 200, satu 400 (WHERE status=ACTIVE atomik)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "ACTIVE",
      createdBy: user.id,
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`${baseEndpoint}/${product.id}/unpublish`)
        .set("Cookie", [accessTokenCookie]),
      request(app)
        .post(`${baseEndpoint}/${product.id}/unpublish`)
        .set("Cookie", [accessTokenCookie]),
    ]);

    // Satu menang (200), satu kalah (400 INVALID_STATUS_TRANSITION).
    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);

    // Final state: INACTIVE.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
  });

  // ── Case 9: Race unpublish vs soft-delete ──────────────────
  it("race — unpublish vs DELETE: satu menang, tidak ada state invalid", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "ACTIVE",
      createdBy: user.id,
    });

    const [unpublishRes, deleteRes] = await Promise.all([
      request(app)
        .post(`${baseEndpoint}/${product.id}/unpublish`)
        .set("Cookie", [accessTokenCookie]),
      request(app)
        .delete(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]),
    ]);

    // Delete: ACTIVE → soft-delete → INACTIVE + deletedAt (BR-27).
    // Unpublish: hanya jalan kalau status masih ACTIVE saat write.
    // Kombinasi manapun → tidak ada state invalid:
    //   - Unpublish dulu → INACTIVE, delete → INACTIVE + deletedAt
    //   - Delete dulu   → INACTIVE + deletedAt, unpublish → 404 (deletedAt filter)
    expect([200, 400, 404]).toContain(unpublishRes.status);
    expect(deleteRes.status).toBe(200);

    // Final state selalu: soft-deleted + INACTIVE.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.deletedAt).not.toBeNull();
    expect(stored!.status).toBe("INACTIVE");
  });

  // ── Case 10: Security — updated_by dari session ────────────
  it("200 — updated_by dari session, payload spoofing diabaikan", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "ACTIVE",
      createdBy: user.id,
    });

    // Body palsu — endpoint tidak punya body schema, jadi body
    // diabaikan oleh route. Verifikasi lewat DB: updated_by =
    // user.id dari session.
    await request(app)
      .post(`${baseEndpoint}/${product.id}/unpublish`)
      .set("Cookie", [accessTokenCookie])
      .send({ updated_by: "attacker-id", adminId: "attacker-id" });

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.updatedBy).toBe(user.id);
    expect(stored!.updatedBy).not.toBe("attacker-id");
  });

  // ── Case 11: Cross-endpoint publish → unpublish ────────────
  it("integrasi — publish lalu unpublish: DRAFT → ACTIVE → INACTIVE", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();

    // Seed produk DRAFT dengan syarat BR-07 lengkap.
    const product = await prisma.product.create({
      data: {
        name: "Kaos",
        status: "DRAFT",
        categoryId: CATEGORY_ID,
        createdBy: user.id,
        updatedBy: user.id,
        variants: {
          create: [
            {
              sku: "INT-L",
              price: 100000,
              stock: 10,
              size: "L",
              createdBy: user.id,
              updatedBy: user.id,
            },
          ],
        },
        images: {
          create: [
            {
              url: "https://img/int.png",
              fileKey: "key-int",
              isPrimary: true,
              createdBy: user.id,
            },
          ],
        },
      },
    });

    // Publish
    const publishRes = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe("ACTIVE");

    // Unpublish
    const unpublishRes = await request(app)
      .post(`${baseEndpoint}/${product.id}/unpublish`)
      .set("Cookie", [accessTokenCookie]);
    expect(unpublishRes.status).toBe(200);
    expect(unpublishRes.body.data.status).toBe("INACTIVE");

    // Final state konsisten.
    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stored!.status).toBe("INACTIVE");
  });

  // ── Case 12: Cross-endpoint unpublish → publish (endpoint salah)
  it("integrasi — setelah unpublish, publish endpoint menolak (harus republish)", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
    const product = await seedProduct({
      name: "Kaos",
      status: "ACTIVE",
      createdBy: user.id,
    });

    // Unpublish dulu
    await request(app)
      .post(`${baseEndpoint}/${product.id}/unpublish`)
      .set("Cookie", [accessTokenCookie]);

    // Publish endpoint menolak INACTIVE — publish hanya DRAFT-only.
    // Republish endpoint (belum diimplement) akan handle INACTIVE → ACTIVE.
    const publishRes = await request(app)
      .post(`${baseEndpoint}/${product.id}/publish`)
      .set("Cookie", [accessTokenCookie]);

    expect(publishRes.status).toBe(400);
    expect(publishRes.body.code).toBe("INVALID_STATUS_TRANSITION");
  });
});
