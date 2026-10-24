import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ProductStatus } from "../../../src/generated/prisma";
import { prisma } from "../../../src/lib/prisma";
import {
  deleteProductService,
  deleteProductVariantService,
} from "../../../src/modules/product/product.service"; // sesuaikan path
import { getAccesTokenCookie } from "../helpers/auth";
import { cleanCartDatabase } from "../helpers/database";
import { seedProduct, seedVariant, seedOrderWithItem } from "../helpers/cart";

async function setupVariantWithOrderOnly() {
  const { user } = await getAccesTokenCookie();
  const product = await seedProduct({ status: "ACTIVE" });
  const variant = await seedVariant(product.id, { stock: 5 });
  await seedOrderWithItem(user.id, variant.id); // tidak ada cartItem sama sekali
  return { product, variant };
}

describe("delete produk/varian dengan histori order (integration)", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  describe("varian", () => {
    it("pernah di-order (tanpa cartItem) -> SOFT_DISABLE, bukan error FK", async () => {
      const { variant } = await setupVariantWithOrderOnly();

      const result = await deleteProductVariantService(variant.id);

      expect(result.deleteType).toBe("SOFT_DISABLE");
      const after = await prisma.productVariant.findUnique({
        where: { id: variant.id },
      });
      expect(after).not.toBeNull();
      expect(after?.isActive).toBe(false);
    });

    it("tanpa histori sama sekali -> HARD_DELETE", async () => {
      const product = await seedProduct({ status: "ACTIVE" });
      const variant = await seedVariant(product.id);

      const result = await deleteProductVariantService(variant.id);

      expect(result.deleteType).toBe("HARD_DELETE");
      expect(
        await prisma.productVariant.findUnique({ where: { id: variant.id } }),
      ).toBeNull();
    });
  });

  describe("produk", () => {
    it("punya varian yang pernah di-order (tanpa cartItem) -> SOFT_DELETE + ARCHIVED", async () => {
      const { product } = await setupVariantWithOrderOnly();

      const result = await deleteProductService(product.id);

      expect(result.deleteType).toBe("SOFT_DELETE");
      const after = await prisma.product.findUnique({
        where: { id: product.id },
        include: { variants: true },
      });
      expect(after?.isDeleted).toBe(true);
      expect(after?.status).toBe(ProductStatus.ARCHIVED);
      expect(after?.variants.every((v) => !v.isActive)).toBe(true);
    });

    it("tanpa histori sama sekali -> HARD_DELETE", async () => {
      const product = await seedProduct({ status: "ACTIVE" });
      await seedVariant(product.id);

      const result = await deleteProductService(product.id);

      expect(result.deleteType).toBe("HARD_DELETE");
      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).toBeNull();
    });
  });
});
