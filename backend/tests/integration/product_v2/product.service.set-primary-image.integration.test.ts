// tests/integration-test/product_v2/product.set-primary-image.integration.test.ts
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
// Endpoint ini sendiri tidak panggil Cloudinary, tapi cross-endpoint
// test (upload → set-primary) butuh mock untuk endpoint upload.
// ⚠️ Path: kalau kamu tidak rename, ganti ke `cloudinary` (tanpa `-uploader`).
vi.mock("../../../src/lib/cloudinary-uploader", () => ({
  uploadBufferToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn(),
}));

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { uploadBufferToCloudinary } from "../../../src/lib/cloudinary-uploader";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

const mockUpload = vi.mocked(uploadBufferToCloudinary);

/**
 * Integration test untuk
 * `PATCH /api/v1/admin/products_v2/:id/images/:imageId/primary`.
 *
 * Cakupan:
 *  - Happy path: set non-primary → primary (BR-18); others unset.
 *  - Idempotent: set pada image yang sudah primary → 200, state tidak berubah.
 *  - Set primary pada image yang satu-satunya (edge).
 *  - Product not-found / soft-deleted → 404 PRODUCT_NOT_FOUND.
 *  - Image not-found / milik produk lain (IDOR) → 404 IMAGE_NOT_FOUND
 *    (anti-enumeration, target unchanged).
 *  - Race concurrent set-primary 2 image berbeda → satu menang,
 *    tepat 1 primary final (serialize via product lock).
 *  - Body diabaikan (endpoint param-driven) — body tidak mempengaruhi hasil.
 *  - Params UUID, auth 401.
 *  - Cross-endpoint: upload → set-primary → GET detail konsisten.
 *  - Security: response minimal `{ id, is_primary: true }` — tidak
 *    bocorkan url / fileKey / dst.
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
      fileKey: opts.fileKey ?? "test/seed",
      isPrimary: opts.isPrimary ?? false,
      sortOrder: opts.sortOrder ?? 0,
      createdBy: opts.createdBy,
    },
  });
}

// ── Test suite ─────────────────────────────────────────────────────

describe("PATCH /api/v1/admin/products_v2/:id/images/:imageId/primary", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    await prisma.category.create({
      data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
    });
    vi.clearAllMocks();
    mockUpload.mockReset();
    mockUpload.mockResolvedValue({
      url: "https://test/uploaded.png",
      publicId: "test/uploaded",
    });
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
    it("200 — set non-primary image ke primary, primary lama di-unset (BR-18)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Image A: primary (existing).
      const imgA = await seedImage({
        productId: product.id,
        url: "https://test/a.png",
        isPrimary: true,
        createdBy: user.id,
      });
      // Image B: non-primary (target).
      const imgB = await seedImage({
        productId: product.id,
        url: "https://test/b.png",
        isPrimary: false,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/images/${imgB.id}/primary`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Primary image set successfully");
      expect(res.body.data).toEqual({
        id: imgB.id,
        is_primary: true,
      });

      // DB state: imgB primary, imgA non-primary.
      const storedA = await prisma.productImage.findUnique({
        where: { id: imgA.id },
      });
      const storedB = await prisma.productImage.findUnique({
        where: { id: imgB.id },
      });
      expect(storedA!.isPrimary).toBe(false);
      expect(storedB!.isPrimary).toBe(true);

      // Invariant: tepat 1 primary.
      const primaries = await prisma.productImage.count({
        where: { productId: product.id, isPrimary: true },
      });
      expect(primaries).toBe(1);
    });

    it("200 — idempotent: set pada image yang sudah primary → state tidak berubah", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Sudah primary.
      const img = await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/images/${img.id}/primary`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        id: img.id,
        is_primary: true,
      });

      // State tetap: img primary, 1 primary.
      const stored = await prisma.productImage.findUnique({
        where: { id: img.id },
      });
      expect(stored!.isPrimary).toBe(true);
      const primaries = await prisma.productImage.count({
        where: { productId: product.id, isPrimary: true },
      });
      expect(primaries).toBe(1);
    });

    it("200 — image satu-satunya (no primary sebelumnya) → set jadi primary", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Hanya 1 image, is_primary=false (edge: state invalid via seed langsung).
      // Partial unique index tidak melarang 0 primary — hanya 2+.
      const img = await seedImage({
        productId: product.id,
        isPrimary: false,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/images/${img.id}/primary`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      const stored = await prisma.productImage.findUnique({
        where: { id: img.id },
      });
      expect(stored!.isPrimary).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Idempotency & body diabaikan
  // ═══════════════════════════════════════════════════════════════
  describe("body diabaikan (endpoint param-driven)", () => {
    it("body `{ is_primary: false }` diabaikan — endpoint tetap set target jadi primary", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const img = await seedImage({
        productId: product.id,
        isPrimary: false,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/images/${img.id}/primary`)
        .set("Cookie", [accessTokenCookie])
        // Body berbahaya — client coba paksa is_primary=false.
        .send({ is_primary: false, product_id: "hacked" });

      // Endpoint param-driven: body tidak dibaca. Target jadi primary.
      expect(res.status).toBe(200);
      expect(res.body.data.is_primary).toBe(true);

      const stored = await prisma.productImage.findUnique({
        where: { id: img.id },
      });
      expect(stored!.isPrimary).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Product not found
  // ═══════════════════════════════════════════════════════════════
  describe("product not found", () => {
    it("404 — PRODUCT_NOT_FOUND saat product tidak ada", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .patch(
          `${baseEndpoint}/11111111-1111-4111-8111-999999999999/images/22222222-2222-4222-8222-999999999999/primary`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
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
        .patch(`${baseEndpoint}/${product.id}/images/${img.id}/primary`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Image not found / IDOR
  // ═══════════════════════════════════════════════════════════════
  describe("image not found / IDOR", () => {
    it("404 — IMAGE_NOT_FOUND saat image tidak ada", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      // Seed satu image existing (primary) supaya ada state.
      await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(
          `${baseEndpoint}/${product.id}/images/22222222-2222-4222-8222-999999999999/primary`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("IMAGE_NOT_FOUND");

      // State existing tidak berubah (rollback: unset tidak terjadi).
      const primaries = await prisma.productImage.count({
        where: { productId: product.id, isPrimary: true },
      });
      expect(primaries).toBe(1);
    });

    it("404 — IMAGE_NOT_FOUND saat image milik produk LAIN (IDOR), target unchanged", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const productA = await seedProduct({ name: "A", createdBy: user.id });
      const productB = await seedProduct({ name: "B", createdBy: user.id });

      // Image milik product B.
      const imgB = await seedImage({
        productId: productB.id,
        isPrimary: true,
        createdBy: user.id,
      });
      // Product A punya primary sendiri.
      const imgA = await seedImage({
        productId: productA.id,
        isPrimary: true,
        createdBy: user.id,
      });

      // Request lewat product A → IDOR attempt.
      const res = await request(app)
        .patch(`${baseEndpoint}/${productA.id}/images/${imgB.id}/primary`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      // Anti-enumeration: tidak bisa dibedakan dari "image tidak ada".
      expect(res.body.code).toBe("IMAGE_NOT_FOUND");

      // imgB (produk lain) TIDAK tersentuh.
      const storedB = await prisma.productImage.findUnique({
        where: { id: imgB.id },
      });
      expect(storedB!.isPrimary).toBe(true);

      // imgA (primary produk A) juga tidak berubah — rollback karena
      // IMAGE_NOT_FOUND di-throw sebelum unset primer A (jika unset
      // terjadi, primary A akan false). Ini bukti transaction
      // rollback safety.
      const storedA = await prisma.productImage.findUnique({
        where: { id: imgA.id },
      });
      expect(storedA!.isPrimary).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Race: concurrent set-primary 2 image berbeda
  // ═══════════════════════════════════════════════════════════════
  describe("race — concurrent set-primary", () => {
    it("race — 2 set-primary concurrent ke image berbeda: final tepat 1 primary", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const imgA = await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });
      const imgB = await seedImage({
        productId: product.id,
        isPrimary: false,
        createdBy: user.id,
      });

      // Dua request paralel, target berbeda. Product lock serialize:
      //  - T1 set A primary (sudah primary → idempotent).
      //  - T2 set B primary (unset A, set B).
      // Final state: tergantung timing. Yang pasti, tepat 1 primary.
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`${baseEndpoint}/${product.id}/images/${imgA.id}/primary`)
          .set("Cookie", [accessTokenCookie]),
        request(app)
          .patch(`${baseEndpoint}/${product.id}/images/${imgB.id}/primary`)
          .set("Cookie", [accessTokenCookie]),
      ]);

      // Keduanya sukses (bukan race yang salah satu harus gagal).
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Invariant terjaga: tepat 1 primary.
      const primaries = await prisma.productImage.count({
        where: { productId: product.id, isPrimary: true },
      });
      expect(primaries).toBe(1);

      // Total image tetap 2 (tidak ada yang hilang).
      const total = await prisma.productImage.count({
        where: { productId: product.id },
      });
      expect(total).toBe(2);
    });

    it("race — set-primary + upload concurrent: konsisten 1 primary final", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Setup: 1 image primary existing.
      const imgA = await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });

      // Concurrent: upload image baru + set image A primary (idempotent).
      // Kedua endpoint lock product → serialize.
      const [uploadRes, setRes] = await Promise.all([
        request(app)
          .post(`${baseEndpoint}/${product.id}/images`)
          .set("Cookie", [accessTokenCookie])
          .attach("file", Buffer.from("new-image"), {
            filename: "new.png",
            contentType: "image/png",
          }),
        request(app)
          .patch(`${baseEndpoint}/${product.id}/images/${imgA.id}/primary`)
          .set("Cookie", [accessTokenCookie]),
      ]);

      expect(uploadRes.status).toBe(201);
      expect(setRes.status).toBe(200);

      // Final: tepat 1 primary (bisa A atau image baru — tergantung
      // serialize order; yang pasti bukan 2).
      const primaries = await prisma.productImage.count({
        where: { productId: product.id, isPrimary: true },
      });
      expect(primaries).toBe(1);

      // Total: 2 image.
      const total = await prisma.productImage.count({
        where: { productId: product.id },
      });
      expect(total).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Validasi params & auth
  // ═══════════════════════════════════════════════════════════════
  describe("validasi params & auth", () => {
    it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .patch(
          `${baseEndpoint}/not-a-uuid/images/22222222-2222-4222-8222-222222222222/primary`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("400 — VALIDATION_ERROR saat :imageId bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .patch(
          `${baseEndpoint}/11111111-1111-4111-8111-111111111111/images/not-a-uuid/primary`,
        )
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app).patch(
        `${baseEndpoint}/11111111-1111-4111-8111-111111111111/images/22222222-2222-4222-8222-222222222222/primary`,
      );

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Security: response minimal
  // ═══════════════════════════════════════════════════════════════
  describe("security — response minimal", () => {
    it("response hanya { id, is_primary }, TIDAK bocorkan url / fileKey / productId", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      const img = await seedImage({
        productId: product.id,
        url: "https://test/sensitive.png",
        fileKey: "test/sensitive-key",
        isPrimary: false,
        createdBy: user.id,
      });

      const res = await request(app)
        .patch(`${baseEndpoint}/${product.id}/images/${img.id}/primary`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Field yang WAJIB ada (kontrak PRD).
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("is_primary");
      expect(data.is_primary).toBe(true);

      // Field internal TIDAK boleh bocor.
      expect(data).not.toHaveProperty("url");
      expect(data).not.toHaveProperty("fileKey");
      expect(data).not.toHaveProperty("file_key");
      expect(data).not.toHaveProperty("publicId");
      expect(data).not.toHaveProperty("public_id");
      expect(data).not.toHaveProperty("productId");
      expect(data).not.toHaveProperty("sortOrder");
      expect(data).not.toHaveProperty("createdBy");

      // Tidak bocorkan url lewat response body mentah.
      expect(JSON.stringify(res.body)).not.toContain("sensitive.png");
      expect(JSON.stringify(res.body)).not.toContain("sensitive-key");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 8 — Cross-endpoint
  // ═══════════════════════════════════════════════════════════════
  describe("cross-endpoint", () => {
    it("upload 2 image → set image-2 primary → GET detail konsisten", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Upload 2 image via endpoint.
      mockUpload.mockResolvedValueOnce({
        url: "https://test/img-1.png",
        publicId: "test/img-1",
      });
      const upload1 = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("first"), {
          filename: "first.png",
          contentType: "image/png",
        });
      expect(upload1.status).toBe(201);
      expect(upload1.body.data.is_primary).toBe(true); // first auto-primary

      mockUpload.mockResolvedValueOnce({
        url: "https://test/img-2.png",
        publicId: "test/img-2",
      });
      const upload2 = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("second"), {
          filename: "second.png",
          contentType: "image/png",
        });
      expect(upload2.status).toBe(201);
      expect(upload2.body.data.is_primary).toBe(false); // second non-primary

      // Set image-2 primary.
      const setRes = await request(app)
        .patch(
          `${baseEndpoint}/${product.id}/images/${upload2.body.data.id}/primary`,
        )
        .set("Cookie", [accessTokenCookie]);
      expect(setRes.status).toBe(200);

      // GET detail — konsistensi end-to-end.
      const detailRes = await request(app)
        .get(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(detailRes.status).toBe(200);
      const images = detailRes.body.data.images;
      expect(images).toHaveLength(2);

      const img1 = images.find((i: any) => i.id === upload1.body.data.id);
      const img2 = images.find((i: any) => i.id === upload2.body.data.id);
      expect(img1.is_primary).toBe(false);
      expect(img2.is_primary).toBe(true);

      // Tepat 1 primary di response.
      const primariesInResponse = images.filter(
        (i: any) => i.is_primary === true,
      );
      expect(primariesInResponse).toHaveLength(1);
    });
  });
});
