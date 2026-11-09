import { describe, it, expect, vi, afterEach, afterAll } from "vitest";
import { prisma } from "../../../src/lib/prisma";
import { uploadProductImages } from "../../../src/modules/product/product.service"; // sesuaikan path
import { seedProduct } from "../helpers/cart";

// Hanya Cloudinary yang di-mock; DB tetap nyata.
vi.mock("../../../src/middlewares/upload", () => ({
  uploadManyToCloudinary: vi.fn(async (files: unknown[]) =>
    files.map((_, i) => ({
      url: `https://fake.cdn/${Date.now()}-${Math.random()}-${i}.jpg`,
    })),
  ),
}));

const RACE_ITERATIONS = 30;
const MAX_IMAGES = 8;
const createdProductIds: string[] = [];

const makeFiles = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    originalname: `f${i}.jpg`,
    buffer: Buffer.from("x"),
  })) as unknown as Express.Multer.File[];

async function setupProduct(existingImages = 0) {
  const product = await seedProduct({ status: "ACTIVE" });
  createdProductIds.push(product.id);

  if (existingImages > 0) {
    await prisma.productImage.createMany({
      data: Array.from({ length: existingImages }, (_, i) => ({
        productId: product.id,
        url: `https://fake.cdn/existing-${product.id}-${i}.jpg`,
        isPrimary: i === 0,
        sortOrder: i,
      })),
    });
  }
  return product;
}

const getImages = (productId: string) =>
  prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });

describe("uploadProductImages (integration)", () => {
  afterEach(async () => {
    await prisma.product.deleteMany({
      where: { id: { in: createdProductIds.splice(0) } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("baseline (tanpa concurrency)", () => {
    it("produk tanpa gambar: gambar pertama primary, sortOrder berurutan", async () => {
      const product = await setupProduct(0);

      await uploadProductImages(product.id, makeFiles(2));
      const images = await getImages(product.id);

      expect(images.map((i) => i.isPrimary)).toEqual([true, false]);
      expect(images.map((i) => i.sortOrder)).toEqual([0, 1]);
    });

    it("upload kedua tidak menimpa primary lama dan melanjutkan sortOrder", async () => {
      const product = await setupProduct(0);
      await uploadProductImages(product.id, makeFiles(2));

      await uploadProductImages(product.id, makeFiles(1));
      const images = await getImages(product.id);

      expect(images.filter((i) => i.isPrimary)).toHaveLength(1);
      expect(images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    });

    it("menolak kalau total melewati batas", async () => {
      const product = await setupProduct(7);

      await expect(
        uploadProductImages(product.id, makeFiles(2)),
      ).rejects.toThrow();
      expect(await getImages(product.id)).toHaveLength(7);
    });
  });

  describe("race condition", () => {
    it(`batas ${MAX_IMAGES} gambar tidak boleh terlewati (${RACE_ITERATIONS}x)`, async () => {
      let failures = 0;

      for (let i = 0; i < RACE_ITERATIONS; i++) {
        const product = await setupProduct(0);

        await Promise.allSettled([
          uploadProductImages(product.id, makeFiles(5)),
          uploadProductImages(product.id, makeFiles(5)),
        ]);

        if ((await getImages(product.id)).length > MAX_IMAGES) failures++;
      }

      expect(
        failures,
        `${failures}/${RACE_ITERATIONS} iterasi melewati batas`,
      ).toBe(0);
    });

    it(`hanya satu primary per produk (${RACE_ITERATIONS}x)`, async () => {
      let failures = 0;

      for (let i = 0; i < RACE_ITERATIONS; i++) {
        const product = await setupProduct(0);

        await Promise.all([
          uploadProductImages(product.id, makeFiles(1)),
          uploadProductImages(product.id, makeFiles(1)),
        ]);

        const primaries = (await getImages(product.id)).filter(
          (x) => x.isPrimary,
        );
        if (primaries.length !== 1) failures++;
      }

      expect(
        failures,
        `${failures}/${RACE_ITERATIONS} iterasi primary != 1`,
      ).toBe(0);
    });

    it(`sortOrder tidak bentrok (${RACE_ITERATIONS}x)`, async () => {
      let failures = 0;

      for (let i = 0; i < RACE_ITERATIONS; i++) {
        const product = await setupProduct(0);

        await Promise.all([
          uploadProductImages(product.id, makeFiles(2)),
          uploadProductImages(product.id, makeFiles(2)),
        ]);

        const orders = (await getImages(product.id)).map((x) => x.sortOrder);
        if (new Set(orders).size !== orders.length) failures++;
      }

      expect(
        failures,
        `${failures}/${RACE_ITERATIONS} iterasi sortOrder bentrok`,
      ).toBe(0);
    });
  });
});
