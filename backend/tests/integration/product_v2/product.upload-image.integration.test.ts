// tests/integration-test/product_v2/product.upload-image.integration.test.ts
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
// Integration test ini menguji semua wiring HTTP + DB + service, TAPI
// mencegah panggilan jaringan sungguhan ke Cloudinary. Cocok: bisnis
// logic real, external service mocked.
//
// ⚠️ Kalau kamu tidak rename `lib/cloudinary.ts` → `lib/cloudinary-uploader.ts`,
// ganti path di bawah: `cloudinary` (tanpa `-uploader`).
vi.mock("../../../src/lib/cloudinary-uploader", () => ({
  uploadBufferToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn(),
}));

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../../../src/lib/cloudinary-uploader";
import { cleanCartDatabase } from "../helpers/database";
import { getAccesTokenCookieAdmin } from "../helpers/auth";

const mockUpload = vi.mocked(uploadBufferToCloudinary);
const mockDelete = vi.mocked(deleteFromCloudinary);

/**
 * Integration test untuk `POST /api/v1/admin/products_v2/:id/images`.
 *
 * Cakupan:
 *  - Happy path: upload pertama auto-primary (BR-18), upload kedua non-primary.
 *  - Race concurrent upload saat 0 gambar → tepat 1 primary.
 *  - Validasi middleware: MIME salah, file > 5MB, file kosong, file missing.
 *  - Product not-found / soft-deleted → 404 (tanpa hit Cloudinary).
 *  - Compensating delete saat race (product soft-deleted antara
 *    pre-check & insert).
 *  - Cross-endpoint: upload → GET detail menampilkan image.
 *  - Security: response tidak bocorkan `fileKey` / `publicId` / `productId`.
 *  - Params UUID, auth 401.
 */

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const baseEndpoint = "/api/v1/admin/products_v2";

const MAX_MB = 5; // harus sinkron dengan MAX_IMAGE_SIZE_BYTES

// ── Cloudinary mock default ────────────────────────────────────────
// Set di beforeEach + override per test untuk variasi.

const CLOUDINARY_DEFAULT = {
  url: "https://res.cloudinary.com/test/products/xxx/uuid.png",
  publicId: "products/xxx/uuid",
};

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
  productId: string;
  url?: string;
  fileKey?: string;
  isPrimary?: boolean;
  createdBy: string;
}

async function seedImage(opts: SeedImageOpts) {
  return prisma.productImage.create({
    data: {
      productId: opts.productId,
      url: opts.url ?? "https://test/seed.png",
      fileKey: opts.fileKey ?? "test/seed",
      isPrimary: opts.isPrimary ?? true,
      sortOrder: 0,
      createdBy: opts.createdBy,
    },
  });
}

// ── Test suite ─────────────────────────────────────────────────────

describe("POST /api/v1/admin/products_v2/:id/images", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
    await prisma.category.create({
      data: { id: CATEGORY_ID, name: "Atasan", slug: "atasan" },
    });
    vi.clearAllMocks();
    mockUpload.mockReset();
    mockUpload.mockResolvedValue(CLOUDINARY_DEFAULT);
    mockDelete.mockReset();
    mockDelete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore spyOn (dipakai di test race & compensating delete).
    // vi.mock factory functions tidak terpengaruh restore ini.
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
    it("201 — upload pertama, is_primary=true (BR-18), fileKey=publicId di DB", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("fake-png-bytes"), {
          filename: "test.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Image uploaded successfully");
      expect(res.body.data).toMatchObject({
        url: CLOUDINARY_DEFAULT.url,
        is_primary: true,
        sort_order: 0,
      });
      expect(typeof res.body.data.id).toBe("string");

      // Cloudinary dipanggil dengan buffer + folder per produk.
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const [bufferArg, folderArg] = mockUpload.mock.calls[0];
      expect(Buffer.isBuffer(bufferArg)).toBe(true);
      expect(bufferArg.toString()).toBe("fake-png-bytes");
      expect(folderArg).toBe(`products/${product.id}`);

      // DB: fileKey = publicId Cloudinary (bukan url, bukan originalname).
      const stored = await prisma.productImage.findUnique({
        where: { id: res.body.data.id },
      });
      expect(stored).not.toBeNull();
      expect(stored!.fileKey).toBe(CLOUDINARY_DEFAULT.publicId);
      expect(stored!.url).toBe(CLOUDINARY_DEFAULT.url);
      expect(stored!.isPrimary).toBe(true);
      expect(stored!.createdBy).toBe(user.id);

      // Tidak ada compensating delete saat sukses.
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("201 — upload kedua, is_primary=false (sudah ada primary)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });
      // Seed existing primary.
      await seedImage({
        productId: product.id,
        isPrimary: true,
        createdBy: user.id,
      });

      // Override mock untuk upload kedua.
      mockUpload.mockResolvedValue({
        url: "https://test/img-2.png",
        publicId: "products/xxx/img-2",
      });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("png2"), {
          filename: "second.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.is_primary).toBe(false);

      // DB: tepat 1 primary untuk produk ini.
      const primaries = await prisma.productImage.count({
        where: { productId: product.id, isPrimary: true },
      });
      expect(primaries).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 2 — Race concurrent upload
  // ═══════════════════════════════════════════════════════════════
  describe("race — concurrent upload (0 gambar → 1 primary)", () => {
    it("race — 2 upload concurrent saat 0 gambar: tepat 1 is_primary=true", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Mock upload mengembalikan publicId berbeda per call.
      let call = 0;
      mockUpload.mockImplementation(async () => {
        call++;
        return {
          url: `https://test/img-${call}.png`,
          publicId: `products/${product.id}/img-${call}`,
        };
      });

      // 2 upload paralel — keduanya melihat "0 gambar" di snapshot
      // masing-masing jika tidak di-serialize. Lock product
      // (FOR UPDATE) di service memaksa yang kedua lihat state
      // setelah yang pertama commit → yang kedua jadi non-primary.
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`${baseEndpoint}/${product.id}/images`)
          .set("Cookie", [accessTokenCookie])
          .attach("file", Buffer.from("a"), {
            filename: "a.png",
            contentType: "image/png",
          }),
        request(app)
          .post(`${baseEndpoint}/${product.id}/images`)
          .set("Cookie", [accessTokenCookie])
          .attach("file", Buffer.from("b"), {
            filename: "b.png",
            contentType: "image/png",
          }),
      ]);

      // Kedua sukses.
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      // Tepat 1 response dengan is_primary=true.
      const primaryResponses = [res1, res2].filter(
        (r) => r.body.data?.is_primary === true,
      );
      expect(primaryResponses).toHaveLength(1);

      // DB: tepat 1 primary (partial unique index sebagai fail-closed backup).
      const primaries = await prisma.productImage.count({
        where: { productId: product.id, isPrimary: true },
      });
      expect(primaries).toBe(1);
      // Total 2 image.
      const total = await prisma.productImage.count({
        where: { productId: product.id },
      });
      expect(total).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 3 — Middleware validation (MIME, size, file presence)
  // ═══════════════════════════════════════════════════════════════
  describe("middleware validation", () => {
    it("400 — INVALID_FILE_TYPE saat MIME application/pdf", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("%PDF-1.4"), {
          filename: "doc.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_FILE_TYPE");

      // Tidak hit Cloudinary (middleware reject duluan).
      expect(mockUpload).not.toHaveBeenCalled();
      // Tidak insert DB.
      expect(
        await prisma.productImage.count({ where: { productId: product.id } }),
      ).toBe(0);
    });

    it(`400 — FILE_TOO_LARGE saat file > ${MAX_MB}MB`, async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.alloc((MAX_MB + 1) * 1024 * 1024), {
          filename: "big.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("FILE_TOO_LARGE");
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("400 — VALIDATION_ERROR saat field file tidak dikirim", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        // Tidak ada .attach()
        .field("other", "value");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("400 — VALIDATION_ERROR saat file 0 byte (service guard)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.alloc(0), {
          filename: "empty.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      // Tidak sampai ke Cloudinary (service throw setelah middleware
      // meneruskan file 0-byte).
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 4 — Product not-found / soft-deleted
  // ═══════════════════════════════════════════════════════════════
  describe("product not found", () => {
    it("404 — PRODUCT_NOT_FOUND saat product tidak ada, Cloudinary tidak dipanggil", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .post(`${baseEndpoint}/11111111-1111-4111-8111-999999999999/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("x"), {
          filename: "x.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");

      // Pre-check fast-fail — tidak boros Cloudinary quota.
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("404 — PRODUCT_NOT_FOUND saat product soft-deleted (BR-05)", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({
        createdBy: user.id,
        deletedAt: new Date(),
      });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("x"), {
          filename: "x.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 5 — Compensating delete (race di fase insert)
  // ═══════════════════════════════════════════════════════════════
  describe("compensating delete (race di fase insert)", () => {
    it("race — product soft-deleted di antara pre-check & insert → 404 + compensating delete", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Spy pre-check: paksa melihat product ada, walau setelah
      // itu product di-soft-delete sebelum lock fase insert.
      vi.spyOn(prisma.product, "findFirst").mockResolvedValueOnce({
        id: product.id,
      } as any);

      // Soft-delete betulan di DB — transaction `$queryRaw` (FOR UPDATE
      // WHERE deleted_at IS NULL) akan return 0 rows.
      await prisma.product.update({
        where: { id: product.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("x"), {
          filename: "x.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");

      // Cloudinary SUDAH di-upload (sebelum fase insert), lalu
      // dibersihkan (compensating delete) karena DB gagal.
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith(CLOUDINARY_DEFAULT.publicId);

      // Tidak ada image tersimpan.
      expect(
        await prisma.productImage.count({ where: { productId: product.id } }),
      ).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 6 — Validasi params & auth
  // ═══════════════════════════════════════════════════════════════
  describe("validasi params & auth", () => {
    it("400 — VALIDATION_ERROR saat :id bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookieAdmin();

      const res = await request(app)
        .post(`${baseEndpoint}/not-a-uuid/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("x"), {
          filename: "x.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      // Middleware order: params validate → 400 sebelum multer parse.
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("401 — UNAUTHORIZED tanpa auth", async () => {
      const res = await request(app)
        .post(`${baseEndpoint}/11111111-1111-4111-8111-111111111111/images`)
        .attach("file", Buffer.from("x"), {
          filename: "x.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 7 — Security (DTO tidak bocor)
  // ═══════════════════════════════════════════════════════════════
  describe("security — DTO tidak bocorkan field internal", () => {
    it("response TIDAK memuat fileKey / publicId / productId / createdBy", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      const res = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("x"), {
          filename: "x.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(201);
      const data = res.body.data;

      // Field internal Prisma / Cloudinary tidak boleh bocor.
      expect(data).not.toHaveProperty("fileKey");
      expect(data).not.toHaveProperty("file_key");
      expect(data).not.toHaveProperty("publicId");
      expect(data).not.toHaveProperty("public_id");
      expect(data).not.toHaveProperty("productId");
      expect(data).not.toHaveProperty("product_id");
      expect(data).not.toHaveProperty("createdBy");
      expect(data).not.toHaveProperty("createdAt");

      // Field kontrak wajib ada.
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("url");
      expect(data).toHaveProperty("is_primary");
      expect(data).toHaveProperty("sort_order");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Group 8 — Cross-endpoint
  // ═══════════════════════════════════════════════════════════════
  describe("cross-endpoint", () => {
    it("upload via POST → GET detail produk menampilkan image di images[]", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookieAdmin();
      const product = await seedProduct({ createdBy: user.id });

      // Upload.
      const uploadRes = await request(app)
        .post(`${baseEndpoint}/${product.id}/images`)
        .set("Cookie", [accessTokenCookie])
        .attach("file", Buffer.from("x"), {
          filename: "x.png",
          contentType: "image/png",
        });
      expect(uploadRes.status).toBe(201);

      // GET detail — images[] konsisten.
      const detailRes = await request(app)
        .get(`${baseEndpoint}/${product.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.images).toHaveLength(1);
      expect(detailRes.body.data.images[0]).toMatchObject({
        id: uploadRes.body.data.id,
        url: CLOUDINARY_DEFAULT.url,
        is_primary: true,
        sort_order: 0,
      });
    });
  });
});
