import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { cleanCartDatabase } from "../helpers/database";
import { prisma } from "../../../src/lib/prisma";
import app from "../../../src/app";
import { createTestUser, getAccesTokenCookie } from "../helpers/auth";
import {
  seedCart,
  seedCartItem,
  seedProduct,
  seedVariant,
} from "../helpers/cart";

describe("GET /api/v1/cart (integration)", () => {
  const cartEndpoint = "/api/v1/cart";

  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  it("balas 401 kalau tanpa cookie accessToken", async () => {
    const res = await request(app).get(cartEndpoint);

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Silakan login terlebih dahulu");
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("balas 200 dengan cart_id null kalau user belum pernah punya cart", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      cart_id: null,
      items: [],
      total_quantity: 0,
      total_amount: "0.00",
    });
  });

  it("balas cart isi user yang login, bukan user lain (anti-IDOR)", async () => {
    const owner = await createTestUser();
    const { user: otherUser, accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id);
    const cart = await seedCart(owner.id);
    await seedCartItem(cart.id, variant.id, { quantity: 2 });

    // other user punya cart kosong sendiri
    const otherCart = await seedCart(otherUser.id);

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.cart_id).toBe(otherCart.id);
    expect(res.body.data.cart_id).not.toBe(cart.id);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("menghitung subtotal & total_amount dengan benar dari data di database", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id, {
      stock: 10,
      price: "100000.00",
    });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, {
      quantity: 3,
      priceAtAdd: "100000.00",
    });

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].subtotal).toBe("300000.00");
    expect(res.body.data.total_quantity).toBe(3);
    expect(res.body.data.total_amount).toBe("300000.00");
  });

  it.each([
    ["INACTIVE", { status: "INACTIVE" as const }, "PRODUCT_NOT_ACTIVE"],
    ["DRAFT", { status: "DRAFT" as const }, "PRODUCT_NOT_ACTIVE"],
    ["soft-deleted", { deletedAt: new Date() }, "PRODUCT_DELETED"],
  ])(
    "item dengan produk %s tetap tampil tapi tidak masuk total_amount",
    async (_label, productOverrides, expectedReason) => {
      const { user, accessTokenCookie } = await getAccesTokenCookie();

      const cart = await seedCart(user.id);

      const unavailableProduct = await seedProduct(productOverrides);
      const unavailableVariant = await seedVariant(unavailableProduct.id, {
        price: "500000.00",
      });
      await seedCartItem(cart.id, unavailableVariant.id, { quantity: 1 });

      const activeProduct = await seedProduct();
      const activeVariant = await seedVariant(activeProduct.id, {
        price: "50000.00",
      });
      await seedCartItem(cart.id, activeVariant.id, { quantity: 1 });

      const res = await request(app)
        .get(cartEndpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.body.data.items).toHaveLength(2); // keduanya tetap tampil

      const unavailableItem = res.body.data.items.find(
        (i: { product_variant_id: string }) =>
          i.product_variant_id === unavailableVariant.id,
      );
      expect(unavailableItem.is_available).toBe(false);
      expect(unavailableItem.unavailable_reason).toBe(expectedReason);

      // hanya item ACTIVE yang dihitung
      expect(res.body.data.total_quantity).toBe(1);
      expect(res.body.data.total_amount).toBe("50000.00");
    },
  );

  it("variant soft-deleted tetap tampil, ditandai VARIANT_DELETED, dan tidak masuk total", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id, { deletedAt: new Date() });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, { quantity: 1 });

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].is_available).toBe(false);
    expect(res.body.data.items[0].unavailable_reason).toBe("VARIANT_DELETED");
    expect(res.body.data.total_quantity).toBe(0);
    expect(res.body.data.total_amount).toBe("0.00");
  });

  it("variant dengan stock 0 ditandai OUT_OF_STOCK", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id, { stock: 0 });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, { quantity: 1 });

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.items[0].unavailable_reason).toBe("OUT_OF_STOCK");
    expect(res.body.data.items[0].is_available).toBe(false);
  });

  it("menandai INSUFFICIENT_STOCK jika quantity cart melebihi stok", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct({ status: "ACTIVE" });
    const variant = await seedVariant(product.id, {
      stock: 1,
      price: "100000.00",
    });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, {
      quantity: 3,
      priceAtAdd: "100000.00",
    });

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);

    expect(res.body.data.items[0]).toMatchObject({
      product_variant_id: variant.id,
      quantity: 3,
      available_stock: 1,
      is_available: false,
      unavailable_reason: "INSUFFICIENT_STOCK",
      unit_price: "100000.00",
      subtotal: "300000.00",
    });

    // Item tetap tampil, tetapi tidak masuk total barang yang tersedia.
    expect(res.body.data.total_quantity).toBe(0);
    expect(res.body.data.total_amount).toBe("0.00");
  });

  it("menandai item available jika quantity tepat sama dengan stok", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct({ status: "ACTIVE" });
    const variant = await seedVariant(product.id, {
      stock: 3,
      price: "100000.00",
    });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, {
      quantity: 3,
      priceAtAdd: "100000.00",
    });

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);

    expect(res.body.data.items[0]).toMatchObject({
      product_variant_id: variant.id,
      quantity: 3,
      available_stock: 3,
      is_available: true,
      unavailable_reason: null,
      subtotal: "300000.00",
    });

    expect(res.body.data.total_quantity).toBe(3);
    expect(res.body.data.total_amount).toBe("300000.00");
  });

  it("unit_price memakai price variant saat ini, dan price_changed true kalau beda dari price_at_add", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id, { price: "75000.00" });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, {
      quantity: 1,
      priceAtAdd: "100000.00", // harga saat ditambahkan, lalu turun
    });

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    const item = res.body.data.items[0];
    expect(item.unit_price).toBe("75000.00");
    expect(item.price_at_add).toBe("100000.00");
    expect(item.price_changed).toBe(true);
  });

  it("price_changed false kalau harga variant sama dengan price_at_add", async () => {
    const { user, accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id, { price: "100000.00" });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, {
      quantity: 1,
      priceAtAdd: "100000.00",
    });

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.items[0].price_changed).toBe(false);
  });
});
