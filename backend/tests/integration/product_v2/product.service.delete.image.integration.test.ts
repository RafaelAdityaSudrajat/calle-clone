// tests/integration-test/product_v2/product.delete-image.integration.test.ts
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

// ── Mock Cloudinary ─────────────────────────────────────────────────
// Endpoint delete image memanggil `deleteFromCloudinary(publicId)`
// SETELAH commit DB. Mock di sini supaya test tidak hit jaringan
// Cloudinary sungguhan.
//
// ⚠️ Path: kalau tidak rename `lib/cloudinary.ts` → `lib/cloudinary-uploader.ts`,
// ganti string mock ke `cloudinary` (tanpa `-uploader`).
vi.mock("../../../src/lib/cloudinary-uploader", () => ({
  uploadBufferToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn(),
}));

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { deleteFromCloudinary } from "../../../src/lib/cloudinary-uploader";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

const mockDelete = vi.mocked(deleteFromCloudinary);

/**
 * Integration test untuk
 * `DELETE /api/v1/admin/products_v2/:id/images/:imageId`.
 *
 * Cakupan:
 *  - Happy path delete non-primary (state selain image tidak berubah).
 *  - Happy path delete primary + ada image lain → auto-pick new primary (BR-20).
 *  - Happy path delete last image + ACTIVE → product auto-INACTIVE (BR-20).
 *  - Last image + DRAFT / INACTIVE → status tetap.
 *  - Product not-found / soft-deleted → 404 PRODUCT_NOT_FOUND.
 *  - Image not-found / IDOR (milik produk lain) → 404 IMAGE_NOT_FOUND.
 *  - Double-delete → 2nd request 404.
 *  - Race concurrent delete 2 image terakhir → 0 image + INACTIVE.
 *  - Cloudinary spy: dipanggil dengan `file_key`, bukan `url`.
 *  - Cloudinary delete failure → response 200 tetap sukses (log warning).
 *  - Cross-endpoint: upload → delete → GET detail (image hilang).
 *  - Params UUID, auth 401.
 *
 * Format error (Opsi B): single-error `{ status: "error", code, message }`.
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

interface SeedImageOpts {
  id?: string;
  productId: string;
  url?: string;
  fileKey?: string;
  isPrimary?: boolean;
  sortOrder?: number;
  createdBy: string;
}

async function seedImage(opts: SeedImageOpts) {
  return prisma.productImage.create({
    data: {
      ...(opts.id ? { id: opts.id } : {}),
      productId: opts.productId,
      url: opts.url ?? "https://test/seed.png",
      fileKey: opts.fileKey ?? "test/seed-key",
      isPrimary: opts.isPrimary ?? false,
      sortOrder: opts.sortOrder ?? 0,
      createdBy: opts.createdBy,
    },
  });
}

// ── Test suite ─────────────────────────────────────────────────────

describe("DELETE /api/v1/admin/products_v2/:id/images/:imageId", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    await prisma.category.create({
      data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
    });
    vi.clearAllMocks();
    mockDelete.mockReset();
    mockDelete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 1 — Happy paths
  // ═══════════════════════════════════════════════════════════════
  describe("happy paths", () => {
    it("200 — delete non-primary image: image hilang, primary tetap, status produk tetap", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });

      const imgPrimary = await seedImage({
        productId: product.id,
        url: "https://test/primary.png",
        fileKey: "test/primary-key",
        isPrimary: true,
        createdBy: user.id,
      });
      const imgNonPrimary = await seedImage({
        productId: product.id,
        url: "https://test/non-primary.png",
        fileKey: "test/non-primary-key",
        isPrimary: false,
        createdBy: user.id,
      });

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${imgNonPrimary.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Image deleted successfully");
      expect(res.body.data).toBeNull();

      // Image non-primary hilang dari DB (hard delete, DD-PM-12).
      expect(
        await prisma.productImage.findUnique({
          where: { id: imgNonPrimary.id },
        }),
      ).toBeNull();

      // Primary tidak berubah.
      const storedPrimary = await prisma.productImage.findUnique({
        where: { id: imgPrimary.id },
      });
      expect(storedPrimary!.isPrimary).toBe(true);

      // Product status tidak berubah (bukan last image).
      const storedProduct = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(storedProduct!.status).toBe("ACTIVE");

      // Cloudinary delete dipanggil dengan fileKey dari DB (bukan url).
      expect(mockDelete).toHaveBeenCalledWith("test/non-primary-key");
    });

    it("200 — delete primary + ada image lain: auto-pick new primary (BR-20)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const imgA = await seedImage({
        productId: product.id,
        url: "https://test/a.png",
        fileKey: "test/a-key",
        isPrimary: true,
        sortOrder: 0,
        createdBy: user.id,
      });
      const imgB = await seedImage({
        productId: product.id,
        url: "https://test/b.png",
        fileKey: "test/b-key",
        isPrimary: false,
        sortOrder: 1,
        createdBy: user.id,
      });

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${imgA.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);

      // Image A hilang, image B jadi primary (auto-pick).
      expect(
        await prisma.productImage.findUnique({ where: { id: imgA.id } }),
      ).toBeNull();
      const storedB = await prisma.productImage.findUnique({
        where: { id: imgB.id },
      });
      expect(storedB!.isPrimary).toBe(true);

      // Invariant: tepat 1 primary.
      const primaries = await prisma.productImage.count({
        where: { productId: product.id, isPrimary: true },
      });
      expect(primaries).toBe(1);
    });

    it("200 — delete last image pada produk ACTIVE: product auto-INACTIVE (BR-20) + updatedBy=adminId", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });

      const img = await seedImage({
        productId: product.id,
        fileKey: "test/only-key",
        isPrimary: true,
        createdBy: user.id,
      });

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);

      // Image hilang total.
      expect(
        await prisma.productImage.count({ where: { productId: product.id } }),
      ).toBe(0);

      // Product auto-INACTIVE + audit.
      const storedProduct = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(storedProduct!.status).toBe("INACTIVE");
      expect(storedProduct!.updatedBy).toBe(user.id);
    });

    it("200 — delete last image pada produk DRAFT: status tetap DRAFT (BR-20 hanya ACTIVE)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "DRAFT",
        createdBy: user.id,
      });
      const img = await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
        .set("Cookie", [accessTokenCookie]);

      const storedProduct = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(storedProduct!.status).toBe("DRAFT");
    });

    it("200 — delete last image pada produk INACTIVE: status tetap INACTIVE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "INACTIVE",
        createdBy: user.id,
      });
      const img = await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
        .set("Cookie", [accessTokenCookie]);

      const storedProduct = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(storedProduct!.status).toBe("INACTIVE");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Product not found
  // ═══════════════════════════════════════════════════════════════
  describe("product not found", () => {
    it("404 — PRODUCT_NOT_FOUND saat product tidak ada, Cloudinary tidak dipanggil", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .delete(
          `${baseEndpoint}/11111111-1111-4111-8111-999999999999/images/22222222-2222-4222-8222-999999999999`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
      // Fast-fail sebelum Cloudinary.
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("404 — PRODUCT_NOT_FOUND saat product soft-deleted (BR-05)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        createdBy: user.id,
        deletedAt: new Date(),
      });
      const img = await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
      // Image tidak tersentuh.
      expect(
        await prisma.productImage.findUnique({ where: { id: img.id } }),
      ).not.toBeNull();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Image not found / IDOR / double-delete
  // ═══════════════════════════════════════════════════════════════
  describe("image not found / IDOR / double-delete", () => {
    it("404 — IMAGE_NOT_FOUND saat image tidak ada", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .delete(
          `${baseEndpoint}/${product.id}/images/22222222-2222-4222-8222-999999999999`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("IMAGE_NOT_FOUND");
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("404 — IMAGE_NOT_FOUND saat image milik produk LAIN (IDOR), target unchanged", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const productA = await seedProduct({ name: "A", createdBy: user.id });
      const productB = await seedProduct({ name: "B", createdBy: user.id });

      // Image milik product B.
      const imgB = await seedImage({
        productId: productB.id,
        fileKey: "test/b-key",
        isPrimary: true,
        createdBy: user.id,
      });

      // Request lewat product A → IDOR.
      const res = await request(app)
        .delete(`${baseEndpoint}/${productA.id}/images/${imgB.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("IMAGE_NOT_FOUND");

      // Image milik B TIDAK tersentuh.
      const stored = await prisma.productImage.findUnique({
        where: { id: imgB.id },
      });
      expect(stored).not.toBeNull();
      expect(stored!.isPrimary).toBe(true);
      // Cloudinary delete tidak dipanggil (transaksi abort).
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("404 — double-delete: request kedua dapat IMAGE_NOT_FOUND", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const img = await seedImage({
        productId: product.id,
        fileKey: "test/dbl-key",
        isPrimary: true,
        createdBy: user.id,
      });

      // Delete pertama — sukses.
      const first = await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
        .set("Cookie", [accessTokenCookie]);
      expect(first.status).toBe(200);
      expect(mockDelete).toHaveBeenCalledTimes(1);

      // Delete kedua — 404 (image sudah hilang).
      const second = await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
        .set("Cookie", [accessTokenCookie]);
      expect(second.status).toBe(404);
      expect(second.body.code).toBe("IMAGE_NOT_FOUND");

      // Cloudinary tidak dipanggil ulang.
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Race conditions
  // ═══════════════════════════════════════════════════════════════
  describe("race conditions", () => {
    it("race — concurrent delete 2 image terakhir: state akhir 0 image + product INACTIVE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });

      const imgA = await seedImage({
        productId: product.id,
        fileKey: "test/a-key",
        isPrimary: true,
        createdBy: user.id,
      });
      const imgB = await seedImage({
        productId: product.id,
        fileKey: "test/b-key",
        isPrimary: false,
        createdBy: user.id,
      });

      // Concurrent delete. Product FOR UPDATE serialize:
      //  - T1 delete imgA (primary) → auto-pick imgB primary;
      //    remaining=1 → BR-20 skip status change.
      //  - T2 delete imgB (sekarang primary) → no candidate;
      //    remaining=0 + ACTIVE → product INACTIVE.
      const [res1, res2] = await Promise.all([
        request(app)
          .delete(`${baseEndpoint}/${product.id}/images/${imgA.id}`)
          .set("Cookie", [accessTokenCookie]),
        request(app)
          .delete(`${baseEndpoint}/${product.id}/images/${imgB.id}`)
          .set("Cookie", [accessTokenCookie]),
      ]);

      // Keduanya sukses (delete image berbeda).
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Final: 0 image + product INACTIVE (invariant BR-20).
      const remaining = await prisma.productImage.count({
        where: { productId: product.id },
      });
      expect(remaining).toBe(0);

      const storedProduct = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(storedProduct!.status).toBe("INACTIVE");
    });

    it("race — double-click delete image sama: satu 200, satu 404", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const img = await seedImage({
        productId: product.id,
        fileKey: "test/race-same-key",
        isPrimary: true,
        createdBy: user.id,
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
          .set("Cookie", [accessTokenCookie]),
        request(app)
          .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
          .set("Cookie", [accessTokenCookie]),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 404]);

      // Cloudinary dipanggil sekali saja (yang menang).
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Cloudinary cleanup
  // ═══════════════════════════════════════════════════════════════
  describe("Cloudinary cleanup", () => {
    it("Cloudinary delete gagal → response tetap 200, warning logged (log tidak bocor ke client)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const img = await seedImage({
        productId: product.id,
        fileKey: "test/will-orphan",
        isPrimary: true,
        createdBy: user.id,
      });

      // Cloudinary delete gagal — best-effort, tidak rethrow.
      mockDelete.mockRejectedValue(new Error("Cloudinary 503"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const res = await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
        .set("Cookie", [accessTokenCookie]);

      // Response tetap 200 (DB delete sukses, cleanup gagal).
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();

      // DB state: image hilang.
      expect(
        await prisma.productImage.findUnique({ where: { id: img.id } }),
      ).toBeNull();

      // Warning logged (observability).
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toMatch(/Cloudinary cleanup failed/);

      // Error tidak bocor ke response.
      expect(JSON.stringify(res.body)).not.toMatch(
        /Cloudinary|cleanup|orphan/i,
      );

      warnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Validasi params & auth
  // ═══════════════════════════════════════════════════════════════
  describe("validasi params & auth", () => {
    it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .delete(
          `${baseEndpoint}/not-a-uuid/images/22222222-2222-4222-8222-222222222222`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat :imageId bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .delete(
          `${baseEndpoint}/11111111-1111-4111-8111-111111111111/images/not-a-uuid`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app).delete(
        `${baseEndpoint}/11111111-1111-4111-8111-111111111111/images/22222222-2222-4222-8222-222222222222`,
      );

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Cross-endpoint
  // ═══════════════════════════════════════════════════════════════
  describe("cross-endpoint", () => {
    it("upload → delete → GET detail: image hilang dari images[]", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Upload via endpoint.
      const { uploadBufferToCloudinary } =
        await import("../../../src/lib/cloudinary-uploader");
      const mockUpload = vi.mocked(uploadBufferToCloudinary);
      mockUpload.mockResolvedValueOnce({
        url: "https://test/uploaded.png",
        publicId: "test/uploaded-key",
      });

      const uploadRes = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("fake"), {
          filename: "x.png",
          contentType: "image/png",
        });
      expect(uploadRes.status).toBe(201);
      const imageId = uploadRes.body.data.id;

      // Delete via endpoint.
      const deleteRes = await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${imageId}`)
        .set("Cookie", [accessTokenCookie]);
      expect(deleteRes.status).toBe(200);

      // GET detail: images[] kosong.
      const detailRes = await request(app)
        .get(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.images).toEqual([]);
    });

    it("delete last image pada produk ACTIVE → GET detail: status INACTIVE", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        status: "ACTIVE",
        createdBy: user.id,
      });
      const img = await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });

      await request(app)
        .delete(`${baseEndpoint}/${product.id}/images/${img.id}`)
        .set("Cookie", [accessTokenCookie]);

      const detailRes = await request(app)
        .get(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.status).toBe("INACTIVE");
      expect(detailRes.body.data.images).toEqual([]);
    });
  });
});
