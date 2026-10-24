import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { getAccesTokenCookie } from "../helpers/auth"; // ASUMSI: nama fungsi sign token, satu modul dengan verifyAccessToken
import { cleanCartDatabase } from "../helpers/database";
import {
  seedProduct,
  seedVariant,
  seedCart,
  seedCartItem,
} from "../helpers/cart";
import { prisma } from "../../../src/lib/prisma";

/** User + cart + 1 cart item. accessTokenCookie dikembalikan supaya request pakai user yang SAMA dengan pemilik item. */
async function setupCartItem(
  opts: {
    quantity?: number;
    stock?: number;
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
    priceAtAdd: "100000.00",
  });
  return { user, accessTokenCookie, product, variant, cart, item };
}

describe("DELETE /api/v1/cart/:cartItemId (integration)", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  describe("auth & validasi", () => {
    it("balas 401 kalau tanpa accessTokenCookie accessToken", async () => {
      const res = await request(app).delete(
        "/api/v1/cart/00000000-0000-0000-0000-000000000000",
      );

      expect(res.status).toBe(401);
    });

    it("balas 400 kalau cartItemId bukan UUID", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .delete("/api/v1/cart/bukan-uuid")
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(400);
    });
  });

  describe("kepemilikan (anti-IDOR)", () => {
    it("balas 404 CART_ITEM_NOT_FOUND kalau cartItemId tidak ada", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .delete("/api/v1/cart/00000000-0000-0000-0000-000000000000")
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CART_ITEM_NOT_FOUND");
    });

    it("balas 404 (bukan 403) kalau item milik user lain, dan item tetap ada di database", async () => {
      const { item } = await setupCartItem();
      const { accessTokenCookie: attackeraccessTokenCookie } =
        await getAccesTokenCookie();

      const res = await request(app)
        .delete(`/api/v1/cart/${item.id}`)
        .set("Cookie", [attackeraccessTokenCookie]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CART_ITEM_NOT_FOUND");

      const stillThere = await prisma.cartItem.findUnique({
        where: { id: item.id },
      });
      expect(stillThere).not.toBeNull();
    });
  });

  describe("delete sukses", () => {
    it("balas 200, item terhapus dari database, dan response berisi cart terbaru", async () => {
      const { accessTokenCookie, cart, item } = await setupCartItem({
        quantity: 2,
      });

      const res = await request(app)
        .delete(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Item removed from cart");
      expect(res.body.data.items).toHaveLength(0);

      const inDb = await prisma.cartItem.findUnique({
        where: { id: item.id },
      });
      expect(inDb).toBeNull();

      // Cart tidak ikut terhapus walau item terakhir hilang (cart tanpa expiry)
      expect(res.body.data.cart_id).toBe(cart.id);
      expect(res.body.data.total_quantity).toBe(0);
      expect(res.body.data.total_amount).toBe("0.00");
      const cartInDb = await prisma.cart.findUnique({
        where: { id: cart.id },
      });
      expect(cartInDb).not.toBeNull();
    });

    it("hanya menghapus item yang dituju; item lain di cart yang sama tetap ada dan total dihitung ulang", async () => {
      const { user, accessTokenCookie, cart, item } = await setupCartItem({
        quantity: 2,
      });

      // Item kedua dari produk berbeda (produk sama akan bentrok di unique productId+size+color)
      const product2 = await seedProduct({ basePrice: "50000.00" });
      const variant2 = await seedVariant(product2.id, { stock: 10 });
      const item2 = await seedCartItem(cart.id, variant2.id, {
        quantity: 3,
        priceAtAdd: "50000.00",
      });

      const res = await request(app)
        .delete(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(item2.id);
      expect(res.body.data.total_quantity).toBe(3);
      expect(res.body.data.total_amount).toBe("150000.00"); // 50000 x 3

      const remaining = await prisma.cartItem.count({
        where: { cart: { userId: user.id } },
      });
      expect(remaining).toBe(1);
    });

    it("tetap boleh menghapus item dari produk ARCHIVED", async () => {
      const { accessTokenCookie, item } = await setupCartItem({
        productStatus: "ARCHIVED",
      });

      const res = await request(app)
        .delete(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      const inDb = await prisma.cartItem.findUnique({
        where: { id: item.id },
      });
      expect(inDb).toBeNull();
    });

    it("tetap boleh menghapus item dari variant yang stoknya 0", async () => {
      const { accessTokenCookie, item } = await setupCartItem({ stock: 0 });

      const res = await request(app)
        .delete(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
    });

    it("stok variant TIDAK berubah setelah delete (stok baru dikurangi saat checkout)", async () => {
      const { accessTokenCookie, item, variant } = await setupCartItem({
        quantity: 3,
        stock: 10,
      });

      await request(app)
        .delete(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie]);

      const variantInDb = await prisma.productVariant.findUnique({
        where: { id: variant.id },
      });
      expect(variantInDb?.stock).toBe(10);
    });

    it("delete kedua pada item yang sama balas 404 CART_ITEM_NOT_FOUND", async () => {
      const { accessTokenCookie, item } = await setupCartItem();

      const first = await request(app)
        .delete(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie]);
      expect(first.status).toBe(200);

      const second = await request(app)
        .delete(`/api/v1/cart/${item.id}`)
        .set("Cookie", [accessTokenCookie]);
      expect(second.status).toBe(404);
      expect(second.body.code).toBe("CART_ITEM_NOT_FOUND");
    });
  });
});
