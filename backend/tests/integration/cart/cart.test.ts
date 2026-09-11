import crypto from "crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ProductStatus } from "../../../src/generated/prisma";
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";

import { createTestUser, loginTestUser } from "../helpers/auth";
import { cleanCartDatabase } from "../helpers/database";

interface SeedProductContextArgs {
  stock?: number;
  status?: ProductStatus;
  deletedAt?: Date | null;
  isActive?: boolean;
}

/**
 * Helper khusus untuk setup data Katalog (Category, Product, Variant)
 * Ditambahkan opsi `isActive` untuk varian sesuai pembaruan service.
 */
const seedProductContext = async ({
  stock = 10,
  status = ProductStatus.ACTIVE,
  deletedAt = null as Date | null,
  isActive = true,
}: SeedProductContextArgs = {}) => {
  const category = await prisma.category.create({
    data: {
      name: "Pakaian",
      slug: `pakaian-${crypto.randomUUID()}`,
    },
  });

  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: "Kaos Basic",
      slug: `kaos-${crypto.randomUUID()}`,
      basePrice: 50000,
      status,
      deletedAt,
    },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `SKU-${crypto.randomUUID()}`,
      stock,
      size: "L",
      color: "Hitam",
      isActive, // Field baru untuk mengecek soft-disable variant
    },
  });

  return { category, product, variant };
};

describe("Cart Integration", () => {
  const cartEndpoint = "/api/cart";

  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  /**
   * =====================================
   * GET CART LOGIC
   * =====================================
   */
  describe("GET /api/cart", () => {
    it("returns 404 if the user does not have a cart yet", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);

      const response = await request(app)
        .get(cartEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/not found/i);
    });

    it("returns 200 and the cart data if the cart exists", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);
      const { variant } = await seedProductContext();

      const cart = await prisma.cart.create({ data: { userId: user.id } });
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 2,
        },
      });

      const response = await request(app)
        .get(cartEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(response.status).toBe(200);
      expect(response.body.data.cartItems).toHaveLength(1);
      expect(response.body.data.cartItems[0].productVariant.sku).toBe(
        variant.sku,
      );
    });
  });

  /**
   * =====================================
   * ADD TO CART LOGIC
   * =====================================
   */
  describe("POST /api/cart", () => {
    it("creates a new cart and adds item using upsert if user does not have a cart", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);
      const { variant } = await seedProductContext({ stock: 5 });

      const response = await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 2,
        });

      expect(response.status).toBe(200);

      const dbCart = await prisma.cart.findUnique({
        where: { userId: user.id },
        include: { cartItems: true },
      });

      expect(dbCart).not.toBeNull();
      expect(dbCart?.cartItems).toHaveLength(1);
      expect(dbCart?.cartItems[0].quantity).toBe(2);
    });

    it("accumulates quantity using atomic increment if the item is already in the cart", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);
      const { variant } = await seedProductContext({ stock: 10 });

      // Add pertama (Qty: 2)
      await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 2,
        });

      // Add kedua dengan variant yang sama (Qty: 3)
      const response = await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 3,
        });

      expect(response.status).toBe(200);

      const dbCart = await prisma.cart.findUnique({
        where: { userId: user.id },
        include: { cartItems: true },
      });

      // Verifikasi total harus 5 berkat upsert increment
      expect(dbCart?.cartItems[0].quantity).toBe(5);
    });

    /**
     * =====================================
     * BUSINESS CONSTRAINTS & ERRORS
     * =====================================
     */
    it("rejects if the product VARIANT is not active (soft-disabled)", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);
      // Setup varian menjadi tidak aktif
      const { variant } = await seedProductContext({ isActive: false });

      const response = await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 1,
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/variant tidak tersedia/i);
    });

    it("rejects if the initial quantity exceeds available stock", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);
      const { variant } = await seedProductContext({ stock: 5 });

      const response = await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 10,
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/melebihi stock/i);
    });

    it("rejects if accumulated quantity exceeds available stock", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);
      const { variant } = await seedProductContext({ stock: 10 });

      // Add pertama (Qty: 8)
      await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 8,
        });

      // Add kedua (Qty: 3) -> Total jadi 11 (melebihi 10)
      const response = await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 3,
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/stock tidak cukup/i);
    });

    it("rejects if the product status is not ACTIVE", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);
      const { variant } = await seedProductContext({
        status: ProductStatus.DRAFT,
      });

      const response = await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 1,
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/product tidak tersedia/i);
    });

    it("rejects if the product is soft-deleted", async () => {
      const user = await createTestUser();
      const { accessTokenCookie } = await loginTestUser(user.email);
      const { variant } = await seedProductContext({
        status: ProductStatus.ACTIVE,
        deletedAt: new Date(),
      });

      const response = await request(app)
        .post(cartEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send({
          productVariantId: variant.id,
          quantity: 1,
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/sudah di hapus/i);
    });
  });
});
