import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { cleanCartDatabase } from "../helpers/database";
import { prisma } from "../../../src/lib/prisma";
import app from "../../../src/app";
import { createTestUser, loginTestUser } from "../helpers/auth";
import { ProductStatus } from "../../../src/generated/prisma";
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

  it("balas 401 kalau tanpa Authorization header", async () => {
    const res = await request(app).get("/api/v1/cart");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Silakan login terlebih dahulu");
    expect(res.body.code).toBe(401);
  });

  it("balas 200 dengan cart_id null kalau user belum pernah punya cart", async () => {
    const user = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(user.email);

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
    const otherUser = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(otherUser.email);

    const product = await seedProduct();
    const variant = await seedVariant(product.id);
    const cart = await seedCart(owner.id);
    await seedCartItem(cart.id, variant.id, { quantity: 2 });

    // other user punya cart kosong sendiri
    await seedCart(otherUser.id);

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.cart_id).not.toBe(cart.id);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("menghitung subtotal & total_amount dengan benar dari data di database", async () => {
    const user = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(user.email);

    const product = await seedProduct({ basePrice: "100000.00" });
    const variant = await seedVariant(product.id, { stock: 10 });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, {
      quantity: 3,
      priceAtAdd: "100000.00",
    });

    const res = await request(app)
      .get("/api/v1/cart")
      .set("Cookie", [accessTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].subtotal).toBe("300000.00");
    expect(res.body.data.total_quantity).toBe(3);
    expect(res.body.data.total_amount).toBe("300000.00");
  });

  it("item dengan produk ARCHIVED tetap tampil tapi tidak masuk total_amount", async () => {
    const user = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(user.email);

    const cart = await seedCart(user.id);

    const archivedProduct = await seedProduct({
      status: "ARCHIVED",
      basePrice: "500000.00",
    });
    const archivedVariant = await seedVariant(archivedProduct.id);
    await seedCartItem(cart.id, archivedVariant.id, { quantity: 1 });

    const activeProduct = await seedProduct({ basePrice: "50000.00" });
    const activeVariant = await seedVariant(activeProduct.id);
    await seedCartItem(cart.id, activeVariant.id, { quantity: 1 });

    const res = await request(app)
      .get("/api/v1/cart")
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.items).toHaveLength(2); // keduanya tetap tampil

    const archivedItem = res.body.data.items.find(
      (i: { product_variant_id: string }) =>
        i.product_variant_id === archivedVariant.id,
    );
    expect(archivedItem.is_available).toBe(false);
    expect(archivedItem.unavailable_reason).toBe("PRODUCT_NOT_ACTIVE");

    // hanya item ACTIVE yang dihitung
    expect(res.body.data.total_quantity).toBe(1);
    expect(res.body.data.total_amount).toBe("50000.00");
  });

  it("variant dengan stock 0 ditandai OUT_OF_STOCK", async () => {
    const user = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(user.email);

    const product = await seedProduct();
    const variant = await seedVariant(product.id, { stock: 0 });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, { quantity: 1 });

    const res = await request(app)
      .get("/api/v1/cart")
      .set("Cookie", [accessTokenCookie]);

    expect(res.body.data.items[0].unavailable_reason).toBe("OUT_OF_STOCK");
    expect(res.body.data.items[0].is_available).toBe(false);
  });

  it("priceOverride dipakai sebagai unit_price, dan price_changed true kalau beda dari price_at_add", async () => {
    const user = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(user.email);

    const product = await seedProduct({ basePrice: "100000.00" });
    const variant = await seedVariant(product.id, {
      priceOverride: "75000.00",
    });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, {
      quantity: 1,
      priceAtAdd: "100000.00", // disimpan saat belum ada override
    });

    const res = await request(app)
      .get("/api/v1/cart")
      .set("Cookie", [accessTokenCookie]);

    const item = res.body.data.items[0];
    expect(item.unit_price).toBe("75000.00");
    expect(item.price_at_add).toBe("100000.00");
    expect(item.price_changed).toBe(true);
  });
});
