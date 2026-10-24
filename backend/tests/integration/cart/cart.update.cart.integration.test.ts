import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app"; // sesuaikan path dengan struktur tests/ kamui
import { Prisma } from "../../../src/generated/prisma";
import { getAccesTokenCookie } from "../helpers/auth"; // ASUMSI: nama fungsi sign token, satu modul dengan verifyAccessToken
import { cleanCartDatabase } from "../helpers/database";
import {
  seedProduct,
  seedVariant,
  seedCart,
  seedCartItem,
} from "../helpers/cart";
import { prisma } from "../../../src/lib/prisma";

/** Siapkan user + cart + 1 cart item. Return semua yang dibutuhkan test. */
async function setupCartItem(
  opts: {
    quantity?: number;
    stock?: number;
    priceAtAdd?: string;
    productStatus?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  } = {},
) {
  const { user, accessTokenCookie } = await getAccesTokenCookie();
  const product = await seedProduct({
    status: opts.productStatus ?? "ACTIVE",
    basePrice: "100000.00",
  });
  const variant = await seedVariant(product.id, { stock: opts.stock ?? 10 });
  const cart = await seedCart(user.id);
  const item = await seedCartItem(cart.id, variant.id, {
    quantity: opts.quantity ?? 2,
    priceAtAdd: opts.priceAtAdd ?? "100000.00",
  });
  return { user, accessTokenCookie, product, variant, cart, item };
}

describe("PATCH /api/v1/cart/:cartItemId (integration)", () => {
  const cartEndpoint = "/api/v1/cart";

  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  it("balas 401 kalau tanpa cookie accessToken", async () => {
    const res = await request(app)
      .patch("/api/v1/cart/00000000-0000-0000-0000-000000000000")
      .send({ quantity: 1 });

    expect(res.status).toBe(401);
  });

  describe("validasi & kepemilikan", () => {
    it("balas 404 CART_ITEM_NOT_FOUND kalau cartItemId tidak ada", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .patch("/api/v1/cart/00000000-0000-0000-0000-000000000000")
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 1 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CART_ITEM_NOT_FOUND");
    });

    it("balas 404 CART_ITEM_NOT_FOUND (bukan 403) kalau item milik user lain, dan data tidak berubah (anti-IDOR)", async () => {
      const { item } = await setupCartItem({ quantity: 2 });
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 9 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CART_ITEM_NOT_FOUND");

      const unchanged = await prisma.cartItem.findUnique({
        where: { id: item.id },
      });
      expect(unchanged?.quantity).toBe(2);
    });

    it("balas 400 kalau cartItemId bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .patch("/api/v1/cart/bukan-uuid")
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 1 });

      expect(res.status).toBe(400);
    });

    it.each([
      ["quantity negatif", { quantity: -1 }],
      ["quantity desimal", { quantity: 1.5 }],
      ["quantity string", { quantity: "2" }],
      ["quantity hilang", {}],
      ["field asing (strictObject)", { quantity: 1, price: 1 }],
    ])("balas 400 untuk body: %s", async (_label, body) => {
      const { item } = await setupCartItem();
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send(body);

      expect(res.status).toBe(400);
    });
  });

  describe("update quantity (> 0)", () => {
    it("balas 200 dan quantity ditimpa absolute (naik)", async () => {
      const { item, accessTokenCookie } = await setupCartItem({
        quantity: 2,
        stock: 10,
      });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Cart item updated");
      expect(res.body.data.items[0].quantity).toBe(5);

      const inDb = await prisma.cartItem.findUnique({ where: { id: item.id } });
      expect(inDb?.quantity).toBe(5);
    });

    it("quantity bisa DITURUNKAN (bukti absolute set, bukan increment)", async () => {
      const { accessTokenCookie, item } = await setupCartItem({
        quantity: 5,
        stock: 10,
      });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(2); // bukan 7
    });

    it("lolos kalau quantity PAS SAMA DENGAN stok (boundary)", async () => {
      const { accessTokenCookie, item } = await setupCartItem({
        quantity: 1,
        stock: 5,
      });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
    });

    it("balas 400 STOCK_INSUFFICIENT kalau melebihi stok, dan quantity di database tidak berubah", async () => {
      const { accessTokenCookie, item } = await setupCartItem({
        quantity: 2,
        stock: 5,
      });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 6 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("STOCK_INSUFFICIENT");

      const inDb = await prisma.cartItem.findUnique({ where: { id: item.id } });
      expect(inDb?.quantity).toBe(2);
    });

    it("balas 400 PRODUCT_NOT_AVAILABLE kalau produk sudah non-ACTIVE setelah masuk cart", async () => {
      const { accessTokenCookie, item } = await setupCartItem({
        productStatus: "ARCHIVED",
      });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 3 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PRODUCT_NOT_AVAILABLE");
    });

    it("priceAtAdd di database TIDAK berubah walau harga sudah naik dan quantity diupdate", async () => {
      const { accessTokenCookie, product, item } = await setupCartItem({
        priceAtAdd: "100000.00",
      });

      await prisma.product.update({
        where: { id: product.id },
        data: { basePrice: new Prisma.Decimal("150000.00") },
      });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].price_at_add).toBe("100000.00");
      expect(res.body.data.items[0].unit_price).toBe("150000.00");
      expect(res.body.data.items[0].price_changed).toBe(true);

      const inDb = await prisma.cartItem.findUnique({ where: { id: item.id } });
      expect(inDb?.priceAtAdd.toFixed(2)).toBe("100000.00");
    });
  });

  describe("quantity = 0 (delete)", () => {
    it("balas 200, item terhapus dari database, dan hilang dari response", async () => {
      const { accessTokenCookie, item } = await setupCartItem({ quantity: 2 });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 0 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Item removed from cart");
      expect(res.body.data.items).toHaveLength(0);

      const inDb = await prisma.cartItem.findUnique({ where: { id: item.id } });
      expect(inDb).toBeNull();
    });

    it("tetap boleh delete walau produk sudah ARCHIVED (beda dari update quantity > 0)", async () => {
      const { accessTokenCookie, item } = await setupCartItem({
        productStatus: "ARCHIVED",
      });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 0 });

      expect(res.status).toBe(200);

      const inDb = await prisma.cartItem.findUnique({ where: { id: item.id } });
      expect(inDb).toBeNull();
    });

    it("tetap boleh delete walau stok variant 0", async () => {
      const { accessTokenCookie, item } = await setupCartItem({ stock: 0 });

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 0 });

      expect(res.status).toBe(200);
    });

    it("user lain tidak bisa menghapus item orang lain lewat quantity 0, item tetap ada", async () => {
      const { item } = await setupCartItem();
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .patch(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie])
        .send({ quantity: 0 });

      expect(res.status).toBe(404);

      const stillThere = await prisma.cartItem.findUnique({
        where: { id: item.id },
      });
      expect(stillThere).not.toBeNull();
    });
  });
});
