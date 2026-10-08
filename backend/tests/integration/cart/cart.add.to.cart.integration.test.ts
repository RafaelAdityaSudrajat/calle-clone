import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app"; // ASUMSI: entry point Express export { app }, tanpa app.listen()
import {
  createTestUser,
  getAccesTokenCookie,
  loginTestUser,
} from "../helpers/auth"; // ASUMSI: nama fungsi sign token, satu modul dengan verifyAccessToken
import { cleanCartDatabase } from "../helpers/database";
import {
  seedProduct,
  seedVariant,
  seedCart,
  seedCartItem,
} from "../helpers/cart";
import { prisma } from "../../../src/lib/prisma";

/**
 * authenticate middleware baca token dari COOKIE (`req.cookies.accessToken`),
 * bukan header Authorization. Makanya request di sini pakai `.set("Cookie", ...)`,
 * bukan `.set("Authorization", "Bearer ...")` seperti di integration test GET /cart.
 *
 * ASUMSI payload token: { sub: userId, sessionVersion }. authenticate.ts
 * mencocokkan payload.sessionVersion dengan user.sessionVersion di database
 * (default 0 untuk user baru), jadi sessionVersion harus ikut dikirim kalau
 * fungsi signAccessToken kamu mewajibkannya eksplisit.
 */
// function cookieFor(userId: string, sessionVersion = 0) {
//   const token = signAccessToken({ sub: userId, sessionVersion });
//   return `accessToken=${token}`;
// }

describe("POST /api/v1/cart (integration)", () => {
  const cartEndpoint = "/api/v1/cart";

  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  it("balas 401 kalau tanpa Authorization header", async () => {
    const res = await request(app)
      .post(cartEndpoint)
      .send({ product_variant_id: "any", quantity: 1 });

    expect(res.status).toBe(401);
  });

  it("balas 404 PRODUCT_NOT_FOUND kalau variant_id tidak ada di database", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();

    const res = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({
        product_variant_id: "00000000-0000-0000-0000-000000000000",
        quantity: 1,
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("balas 400 PRODUCT_NOT_AVAILABLE kalau produk statusnya DRAFT", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct({ status: "DRAFT" });
    const variant = await seedVariant(product.id);

    const res = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PRODUCT_NOT_AVAILABLE");
  });

  it("balas 400 PRODUCT_NOT_AVAILABLE kalau variant isActive false", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id, { isActive: false });

    const res = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PRODUCT_NOT_AVAILABLE");
  });

  it("balas 400 STOCK_INSUFFICIENT kalau quantity melebihi stok", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id, { stock: 3 });

    const res = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 5 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("STOCK_INSUFFICIENT");
  });

  it("balas 400 STOCK_INSUFFICIENT berdasarkan quantity akumulasi (sudah ada di cart + baru)", async () => {
    const { accessTokenCookie, user } = await getAccesTokenCookie();

    const product = await seedProduct();
    const variant = await seedVariant(product.id, { stock: 5 });
    const cart = await seedCart(user.id);
    await seedCartItem(cart.id, variant.id, { quantity: 3 }); // sudah ada 3

    const res = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 3 }); // 3 + 3 = 6 > 5

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("STOCK_INSUFFICIENT");

    // pastikan quantity di database TIDAK berubah (gagal = tidak ada efek)
    const item = await prisma.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: variant.id,
        },
      },
    });
    expect(item?.quantity).toBe(3);
  });

  it("balas 201 dan auto-create cart untuk user yang belum pernah punya cart", async () => {
    const { accessTokenCookie, user } = await getAccesTokenCookie();

    const product = await seedProduct({ basePrice: "100000.00" });
    const variant = await seedVariant(product.id, { stock: 10 });

    const res = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.cart_id).not.toBeNull();
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.items[0].subtotal).toBe("200000.00");

    const cartInDb = await prisma.cart.findUnique({
      where: { userId: user.id },
    });
    expect(cartInDb).not.toBeNull();
  });

  it("add dua kali ke variant yang sama -> quantity bertambah (atomic increment), bukan ketimpa", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();
    const product = await seedProduct();
    const variant = await seedVariant(product.id, { stock: 10 });

    await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 2 });

    const res2 = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 3 });

    expect(res2.status).toBe(201);
    expect(res2.body.data.items).toHaveLength(1); // tetap 1 row, bukan 2 row
    expect(res2.body.data.items[0].quantity).toBe(5); // 2 + 3, bukan ketimpa jadi 3
  });

  it("price_at_add tetap snapshot dari add PERTAMA, walau harga berubah sebelum add kedua", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();
    const product = await seedProduct({ basePrice: "100000.00" });
    const variant = await seedVariant(product.id, { stock: 10 });

    const res1 = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 1 });
    expect(res1.body.data.items[0].price_at_add).toBe("100000.00");
    expect(res1.body.data.items[0].price_changed).toBe(false);

    // Harga naik SETELAH add pertama
    await prisma.product.update({
      where: { id: product.id },
      data: {
        basePrice: new (
          await import("../../../src/generated/prisma")
        ).Prisma.Decimal("150000.00"),
      },
    });

    const res2 = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 1 });

    expect(res2.body.data.items[0].price_at_add).toBe("100000.00"); // tetap snapshot awal
    expect(res2.body.data.items[0].unit_price).toBe("150000.00"); // harga sekarang
    expect(res2.body.data.items[0].price_changed).toBe(true);
  });

  it("balas 400 kalau quantity 0 (add minimal 1, beda dari update)", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();
    const product = await seedProduct();
    const variant = await seedVariant(product.id);

    const res = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 0 });

    expect(res.status).toBe(400);
  });

  it("balas 400 kalau field asing dikirim (strictObject)", async () => {
    const { accessTokenCookie } = await getAccesTokenCookie();
    const product = await seedProduct();
    const variant = await seedVariant(product.id);

    const res = await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({ product_variant_id: variant.id, quantity: 1, price: 1 });

    expect(res.status).toBe(400);
  });

  it("cart item hanya milik user yang login, tidak bocor ke user lain", async () => {
    const owner = await createTestUser();
    const { accessTokenCookie: accessTokenCookieOwnerUser } =
      await loginTestUser(owner.email);
    const otherUser = await createTestUser();
    const { accessTokenCookie: accessTokenCookieOtherUser } =
      await loginTestUser(otherUser.email);
    const product = await seedProduct();
    const variant = await seedVariant(product.id, { stock: 10 });

    await request(app)
      .post(cartEndpoint)
      .set("Cookie", [accessTokenCookieOwnerUser])
      .send({ product_variant_id: variant.id, quantity: 1 });

    const res = await request(app)
      .get(cartEndpoint)
      .set("Cookie", [accessTokenCookieOtherUser]);

    expect(res.body.data.items).toHaveLength(0);
  });
});
