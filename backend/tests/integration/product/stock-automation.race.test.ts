import { describe, it, expect, afterEach, afterAll } from "vitest";
import { ProductStatus } from "../../../src/generated/prisma";
import { prisma } from "../../../src/lib/prisma";
import {
  updateProductVariantService,
  deleteProductVariantService,
} from "../../../src/modules/product/product.service";
import { getAccesTokenCookie } from "../helpers/auth";
import { cleanCartDatabase } from "../helpers/database";
import {
  seedProduct,
  seedVariant,
  seedCart,
  seedCartItem,
} from "../helpers/cart";

const RACE_ITERATIONS = 30;
const createdProductIds: string[] = [];

/** Produk ACTIVE dengan N varian aktif, masing-masing stok `stock`. */
async function setupActiveProduct(variantCount = 2, stock = 5) {
  const product = await seedProduct({ status: "ACTIVE" });
  createdProductIds.push(product.id);

  const variants = [];
  for (let i = 0; i < variantCount; i++) {
    variants.push(
      await seedVariant(product.id, { stock, color: `Color-${i}` }),
    );
  }
  return { product, variants };
}

async function setupActiveProductWithCartItems(variantCount = 2, stock = 5) {
  const { product, variants } = await setupActiveProduct(variantCount, stock);
  const { user } = await getAccesTokenCookie();
  const cart = await seedCart(user.id);

  for (const v of variants) {
    await seedCartItem(cart.id, v.id);
  }
  return { product, variants };
}

async function getStatus(productId: string) {
  const p = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { status: true },
  });
  return p.status;
}

describe("runStockAutomation (integration, race condition)", () => {
  afterEach(async () => {
    // Cleanup mandiri: variants & images ikut terhapus lewat onDelete: Cascade
    await prisma.product.deleteMany({
      where: { id: { in: createdProductIds.splice(0) } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("baseline (tanpa concurrency)", () => {
    it("ACTIVE -> OUT_OF_STOCK kalau semua varian aktif stoknya 0 (berurutan)", async () => {
      const { product, variants } = await setupActiveProduct(2, 5);

      await updateProductVariantService(variants[0].id, { stock: 0 });
      expect(await getStatus(product.id)).toBe(ProductStatus.ACTIVE);

      await updateProductVariantService(variants[1].id, { stock: 0 });
      expect(await getStatus(product.id)).toBe(ProductStatus.OUT_OF_STOCK);
    });

    it("OUT_OF_STOCK -> ACTIVE kalau salah satu varian di-restock (berurutan)", async () => {
      const { product, variants } = await setupActiveProduct(2, 5);
      await updateProductVariantService(variants[0].id, { stock: 0 });
      await updateProductVariantService(variants[1].id, { stock: 0 });

      await updateProductVariantService(variants[0].id, { stock: 3 });

      expect(await getStatus(product.id)).toBe(ProductStatus.ACTIVE);
    });
  });

  describe("write skew: update stok varian berbeda secara paralel", () => {
    it(`status harus OUT_OF_STOCK setelah semua varian di-set 0 bersamaan (${RACE_ITERATIONS}x)`, async () => {
      let failures = 0;

      for (let i = 0; i < RACE_ITERATIONS; i++) {
        const { product, variants } = await setupActiveProduct(2, 5);

        await Promise.all([
          updateProductVariantService(variants[0].id, { stock: 0 }),
          updateProductVariantService(variants[1].id, { stock: 0 }),
        ]);

        if ((await getStatus(product.id)) !== ProductStatus.OUT_OF_STOCK) {
          failures++;
        }
      }

      // Pesan ini yang akan terlihat di versi "merah"
      expect(
        failures,
        `${failures}/${RACE_ITERATIONS} iterasi stuck ACTIVE`,
      ).toBe(0);
    });

    it(`tetap konsisten dengan 3 varian di-set 0 bersamaan (${RACE_ITERATIONS}x)`, async () => {
      let failures = 0;

      for (let i = 0; i < RACE_ITERATIONS; i++) {
        const { product, variants } = await setupActiveProduct(3, 5);

        await Promise.all(
          variants.map((v) => updateProductVariantService(v.id, { stock: 0 })),
        );

        if ((await getStatus(product.id)) !== ProductStatus.OUT_OF_STOCK) {
          failures++;
        }
      }

      expect(
        failures,
        `${failures}/${RACE_ITERATIONS} iterasi stuck ACTIVE`,
      ).toBe(0);
    });
  });

  describe("jalur delete varian", () => {
    it("baseline: hapus semua varian berurutan -> OUT_OF_STOCK", async () => {
      const { product, variants } = await setupActiveProduct(2, 5);

      await deleteProductVariantService(variants[0].id);
      expect(await getStatus(product.id)).toBe(ProductStatus.ACTIVE);

      await deleteProductVariantService(variants[1].id);
      expect(await getStatus(product.id)).toBe(ProductStatus.OUT_OF_STOCK);
    });

    it(`hapus 2 varian bersamaan -> OUT_OF_STOCK (${RACE_ITERATIONS}x)`, async () => {
      let failures = 0;

      for (let i = 0; i < RACE_ITERATIONS; i++) {
        const { product, variants } = await setupActiveProduct(2, 5);

        await Promise.all(
          variants.map((v) => deleteProductVariantService(v.id)),
        );

        if ((await getStatus(product.id)) !== ProductStatus.OUT_OF_STOCK) {
          failures++;
        }
      }

      expect(
        failures,
        `${failures}/${RACE_ITERATIONS} iterasi stuck ACTIVE`,
      ).toBe(0);
    });

    it(`hapus varian A + set stok varian B ke 0 bersamaan -> OUT_OF_STOCK (${RACE_ITERATIONS}x)`, async () => {
      let failures = 0;

      for (let i = 0; i < RACE_ITERATIONS; i++) {
        const { product, variants } = await setupActiveProduct(2, 5);

        await Promise.all([
          deleteProductVariantService(variants[0].id),
          updateProductVariantService(variants[1].id, { stock: 0 }),
        ]);

        if ((await getStatus(product.id)) !== ProductStatus.OUT_OF_STOCK) {
          failures++;
        }
      }

      expect(
        failures,
        `${failures}/${RACE_ITERATIONS} iterasi stuck ACTIVE`,
      ).toBe(0);
    });
  });

  describe("jalur SOFT_DISABLE (varian punya cartItems)", () => {
    // cartItem punya FK ke varian, jadi bersihkan lewat urutan yang sudah benar.
    // Hook inner jalan sebelum afterEach di atas, jadi deleteMany produk tidak kena FK.
    afterEach(async () => {
      await cleanCartDatabase();
    });

    it("baseline: nonaktifkan semua varian berurutan -> OUT_OF_STOCK", async () => {
      const { product, variants } = await setupActiveProductWithCartItems(2, 5);

      const r1 = await deleteProductVariantService(variants[0].id);
      expect(r1.deleteType).toBe("SOFT_DISABLE");
      expect(await getStatus(product.id)).toBe(ProductStatus.ACTIVE);

      await deleteProductVariantService(variants[1].id);
      expect(await getStatus(product.id)).toBe(ProductStatus.OUT_OF_STOCK);
    });

    it(`nonaktifkan 2 varian bersamaan -> OUT_OF_STOCK (${RACE_ITERATIONS}x)`, async () => {
      let failures = 0;

      for (let i = 0; i < RACE_ITERATIONS; i++) {
        const { product, variants } = await setupActiveProductWithCartItems(
          2,
          5,
        );

        await Promise.all(
          variants.map((v) => deleteProductVariantService(v.id)),
        );

        if ((await getStatus(product.id)) !== ProductStatus.OUT_OF_STOCK) {
          failures++;
        }
        await cleanCartDatabase(); // user & cart dibuat ulang tiap iterasi
      }

      expect(
        failures,
        `${failures}/${RACE_ITERATIONS} iterasi stuck ACTIVE`,
      ).toBe(0);
    });
  });
});
