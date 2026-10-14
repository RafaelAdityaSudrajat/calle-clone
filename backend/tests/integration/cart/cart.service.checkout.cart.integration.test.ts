import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { Prisma } from "../../../src/generated/prisma";
import { getAccesTokenCookie } from "../helpers/auth";
import { cleanCartDatabase } from "../helpers/database";
import {
  seedProduct,
  seedVariant,
  seedCart,
  seedCartItem,
} from "../helpers/cart";
import { prisma } from "../../../src/lib/prisma";

const KEY = "11111111-1111-4111-8111-111111111111";
const KEY_ALT = "22222222-2222-4222-8222-222222222222";

function validAddress() {
  return {
    recipient_name: "Budi Santoso",
    phone: "081234567890",
    address_line: "Jl. Contoh No. 1",
    city: "Bandung",
    postal_code: "40111",
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    shipping_address: validAddress(),
    confirm_price_change: false,
    ...overrides,
  };
}

type SeedItem = {
  quantity?: number;
  stock?: number;
  priceAtAdd?: string;
  basePrice?: string;
  priceOverride?: string;
  productStatus?: "ACTIVE" | "DRAFT" | "ARCHIVED";
};

/** Siapkan user + cart + 1 atau lebih cart item. Return semua yang dibutuhkan test. */
async function setupCartWithItems(items: SeedItem[] = [{}]) {
  const { user, accessTokenCookie } = await getAccesTokenCookie();
  const cart = await seedCart(user.id);

  const seeded: Array<{
    product: Awaited<ReturnType<typeof seedProduct>>;
    variant: Awaited<ReturnType<typeof seedVariant>>;
    item: Awaited<ReturnType<typeof seedCartItem>>;
  }> = [];

  for (const o of items) {
    const product = await seedProduct({
      status: o.productStatus ?? "ACTIVE",
      basePrice: o.basePrice ?? "100000.00",
    });
    const variant = await seedVariant(product.id, {
      stock: o.stock ?? 10,
      ...(o.priceOverride ? { priceOverride: o.priceOverride } : {}),
    });
    const item = await seedCartItem(cart.id, variant.id, {
      quantity: o.quantity ?? 2,
      priceAtAdd: o.priceAtAdd ?? o.basePrice ?? "100000.00",
    });
    seeded.push({ product, variant, item });
  }

  return { user, accessTokenCookie, cart, items: seeded };
}

describe("POST /api/v1/cart/checkout (integration)", () => {
  const checkoutEndpoint = "/api/v1/cart/checkout";

  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // Otentikasi & validasi request
  // ------------------------------------------------------------------
  describe("otentikasi & validasi request", () => {
    it("balas 401 kalau tanpa cookie accessToken", async () => {
      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(401);
    });

    it("balas 400 kalau header Idempotency-Key tidak dikirim", async () => {
      const { accessTokenCookie } = await setupCartWithItems();

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .send(body());

      expect(res.status).toBe(400);
    });

    it("balas 400 kalau Idempotency-Key bukan UUID", async () => {
      const { accessTokenCookie } = await setupCartWithItems();

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", "bukan-uuid")
        .send(body());

      expect(res.status).toBe(400);
    });

    it.each([
      [
        "recipient_name hilang",
        { shipping_address: { ...validAddress(), recipient_name: undefined } },
      ],
      [
        "phone format salah",
        { shipping_address: { ...validAddress(), phone: "abc" } },
      ],
      [
        "postal_code bukan 5 digit",
        { shipping_address: { ...validAddress(), postal_code: "12" } },
      ],
      ["shipping_address hilang", { shipping_address: undefined }],
      [
        "field asing (strictObject)",
        { shipping_address: { ...validAddress(), extra: "x" } },
      ],
    ])(
      "balas 400 INVALID_ADDRESS untuk alamat: %s",
      async (_label, override) => {
        const { accessTokenCookie } = await setupCartWithItems();

        const res = await request(app)
          .post(checkoutEndpoint)
          .set("Cookie", [accessTokenCookie])
          .set("Idempotency-Key", KEY)
          .send(body(override));

        expect(res.status).toBe(400);
      },
    );
  });

  // ------------------------------------------------------------------
  // Checkout sukses
  // ------------------------------------------------------------------
  describe("cart kosong", () => {
    it("balas 400 CART_EMPTY kalau user belum punya cart sama sekali", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CART_EMPTY");

      const orderCount = await prisma.order.count();
      expect(orderCount).toBe(0);
    });

    it("balas 400 CART_EMPTY kalau cart ada tapi tidak punya item", async () => {
      const { user, accessTokenCookie } = await getAccesTokenCookie();
      await seedCart(user.id);

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CART_EMPTY");
    });
  });

  //   // ------------------------------------------------------------------
  //   // Checkout sukses
  //   // ------------------------------------------------------------------
  describe("checkout sukses", () => {
    it("balas 201, order dibuat, cart dikosongkan, stok berkurang, cart row tetap ada", async () => {
      const { accessTokenCookie, cart, items } = await setupCartWithItems([
        { quantity: 2, stock: 10, basePrice: "100000.00" },
      ]);
      const { variant } = items[0];

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Order created successfully");
      expect(res.body.data.idempotent_replay).toBe(false);
      expect(res.body.data.status).toBe("PENDING_PAYMENT");
      expect(res.body.data.payment_status).toBe("UNPAID");
      expect(res.body.data.total_amount).toBe("200000.00");

      // Order + items ada di DB
      const order = await prisma.order.findUnique({
        where: { id: res.body.data.order_id },
        include: { items: true },
      });
      expect(order).not.toBeNull();
      expect(order?.totalAmount.toFixed(2)).toBe("200000.00");
      expect(order?.items).toHaveLength(1);

      // Cart dikosongkan, tapi row Cart-nya masih ada
      const remaining = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });
      expect(remaining).toHaveLength(0);
      const cartRow = await prisma.cart.findUnique({ where: { id: cart.id } });
      expect(cartRow).not.toBeNull();

      // Stok berkurang
      const after = await prisma.productVariant.findUnique({
        where: { id: variant.id },
      });
      expect(after?.stock).toBe(8); // 10 - 2
    });

    it("total_amount = jumlah subtotal semua item", async () => {
      const { accessTokenCookie } = await setupCartWithItems([
        { quantity: 2, basePrice: "100000.00" },
        { quantity: 3, basePrice: "50000.00" },
      ]);

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(201);
      expect(res.body.data.total_amount).toBe("350000.00"); // 200k + 150k
      expect(res.body.data.items).toHaveLength(2);
    });

    it("priceOverride dipakai sebagai harga, bukan basePrice", async () => {
      const { accessTokenCookie } = await setupCartWithItems([
        {
          quantity: 2,
          basePrice: "120000.00",
          priceOverride: "90000.00",
          priceAtAdd: "90000.00",
        },
      ]);

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(201);
      expect(res.body.data.items[0].unit_price).toBe("90000.00");
      expect(res.body.data.total_amount).toBe("180000.00");
    });

    it("DTO response sesuai kontrak", async () => {
      const { accessTokenCookie } = await setupCartWithItems([
        { quantity: 2, basePrice: "100000.00" },
      ]);

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.body.data).toMatchObject({
        order_id: expect.any(String),
        status: "PENDING_PAYMENT",
        payment_status: "UNPAID",
        total_amount: "200000.00",
        idempotent_replay: false,
      });
      expect(res.body.data.items[0]).toMatchObject({
        id: expect.any(String),
        product_variant_id: expect.any(String),
        product_name: expect.any(String),
        variant_sku: expect.any(String),
        unit_price: "100000.00",
        quantity: 2,
        subtotal: "200000.00",
      });
    });
  });

  // ------------------------------------------------------------------
  // Idempotency
  // ------------------------------------------------------------------
  describe("idempotency", () => {
    it("2x POST dengan key SAMA (sequential) -> hanya 1 order, request kedua balas 200 replay", async () => {
      const { accessTokenCookie } = await setupCartWithItems();

      const first = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(first.status).toBe(201);
      expect(first.body.data.idempotent_replay).toBe(false);

      const second = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(second.status).toBe(200);
      expect(second.body.data.idempotent_replay).toBe(true);
      expect(second.body.data.order_id).toBe(first.body.data.order_id);

      expect(await prisma.order.count()).toBe(1);
    });

    it("2x POST dengan key SAMA (paralel) -> tetap hanya 1 order", async () => {
      const { accessTokenCookie } = await setupCartWithItems();

      const [a, b] = await Promise.all([
        request(app)
          .post(checkoutEndpoint)
          .set("Cookie", [accessTokenCookie])
          .set("Idempotency-Key", KEY)
          .send(body()),
        request(app)
          .post(checkoutEndpoint)
          .set("Cookie", [accessTokenCookie])
          .set("Idempotency-Key", KEY)
          .send(body()),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.data.order_id).toBe(b.body.data.order_id);
      expect(await prisma.order.count()).toBe(1);
    });

    it("key SAMA dari user BERBEDA tidak bentrok (compound key userId + key)", async () => {
      const userA = await setupCartWithItems();
      const userB = await setupCartWithItems();

      const resA = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [userA.accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      const resB = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [userB.accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);
      expect(resA.body.data.order_id).not.toBe(resB.body.data.order_id);
      expect(await prisma.order.count()).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // Produk tidak tersedia / stok
  // ------------------------------------------------------------------
  describe("produk tidak tersedia & stok", () => {
    it("balas 400 PRODUCT_NOT_AVAILABLE kalau produk sudah ARCHIVED, cart tetap utuh", async () => {
      const { accessTokenCookie, cart } = await setupCartWithItems([
        { productStatus: "ARCHIVED" },
      ]);

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PRODUCT_NOT_AVAILABLE");

      expect(await prisma.order.count()).toBe(0);
      const remaining = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });
      expect(remaining).toHaveLength(1);
    });

    it("balas 400 STOCK_INSUFFICIENT kalau quantity > stock, tidak ada order terbentuk dan stok tidak berubah", async () => {
      const { accessTokenCookie, items } = await setupCartWithItems([
        { quantity: 5, stock: 3 },
      ]);
      const { variant } = items[0];

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("STOCK_INSUFFICIENT");

      expect(await prisma.order.count()).toBe(0);
      const after = await prisma.productVariant.findUnique({
        where: { id: variant.id },
      });
      expect(after?.stock).toBe(3); // tidak berubah
    });

    it("1 item bermasalah menolak SEMUA (all-or-nothing), stok item yang sehat juga tidak berkurang", async () => {
      const { accessTokenCookie, items } = await setupCartWithItems([
        { quantity: 2, stock: 10 }, // sehat
        { quantity: 5, stock: 0 }, // stok habis
      ]);

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("STOCK_INSUFFICIENT");
      expect(await prisma.order.count()).toBe(0);

      const healthy = await prisma.productVariant.findUnique({
        where: { id: items[0].variant.id },
      });
      expect(healthy?.stock).toBe(10); // utuh
    });
  });

  // ------------------------------------------------------------------
  // Perubahan harga
  // ------------------------------------------------------------------
  describe("perubahan harga", () => {
    it("balas 409 PRICE_CHANGED kalau harga naik dan belum dikonfirmasi, cart tetap utuh", async () => {
      const { accessTokenCookie, cart } = await setupCartWithItems([
        { priceAtAdd: "100000.00" },
      ]);

      // Naikkan harga produk setelah item masuk cart
      const cartItem = await prisma.cartItem.findFirst({
        where: { cartId: cart.id },
      });
      const variant = await prisma.productVariant.findUnique({
        where: { id: cartItem!.productVariantId },
      });
      await prisma.product.update({
        where: { id: variant!.productId },
        data: { basePrice: new Prisma.Decimal("120000.00") },
      });

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PRICE_CHANGED");
      expect(await prisma.order.count()).toBe(0);

      const remaining = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });
      expect(remaining).toHaveLength(1);
    });

    it("confirm_price_change=true -> lanjut, order memakai harga TERBARU (freeze)", async () => {
      const { accessTokenCookie, cart } = await setupCartWithItems([
        { quantity: 2, priceAtAdd: "100000.00" },
      ]);

      const cartItem = await prisma.cartItem.findFirst({
        where: { cartId: cart.id },
      });
      const variant = await prisma.productVariant.findUnique({
        where: { id: cartItem!.productVariantId },
      });
      await prisma.product.update({
        where: { id: variant!.productId },
        data: { basePrice: new Prisma.Decimal("120000.00") },
      });

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body({ confirm_price_change: true }));

      expect(res.status).toBe(201);
      expect(res.body.data.items[0].unit_price).toBe("120000.00");
      expect(res.body.data.total_amount).toBe("240000.00");

      // Order item di DB dibekukan di harga baru
      const order = await prisma.order.findUnique({
        where: { id: res.body.data.order_id },
        include: { items: true },
      });
      expect(order?.items[0].unitPrice.toFixed(2)).toBe("120000.00");
    });
  });

  // ------------------------------------------------------------------
  // Snapshot
  // ------------------------------------------------------------------
  describe("snapshot data di order", () => {
    it("snapshot alamat tersimpan apa adanya di order", async () => {
      const { accessTokenCookie } = await setupCartWithItems();

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      const order = await prisma.order.findUnique({
        where: { id: res.body.data.order_id },
      });
      expect(order).toMatchObject({
        shippingRecipientName: "Budi Santoso",
        shippingPhone: "081234567890",
        shippingAddressLine: "Jl. Contoh No. 1",
        shippingCity: "Bandung",
        shippingPostalCode: "40111",
      });
    });

    it("snapshot nama produk & SKU tetap utuh walau produk di-rename setelah order", async () => {
      const { accessTokenCookie, items } = await setupCartWithItems();

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      const orderId = res.body.data.order_id;

      // Rename produk + variant SKU setelah order
      await prisma.product.update({
        where: { id: items[0].product.id },
        data: { name: "Nama Baru" },
      });
      await prisma.productVariant.update({
        where: { id: items[0].variant.id },
        data: { sku: "SKU-BARU" },
      });

      const orderItem = await prisma.orderItem.findFirst({
        where: { orderId },
      });
      expect(orderItem?.productName).not.toBe("Nama Baru");
      expect(orderItem?.variantSku).not.toBe("SKU-BARU");
    });
  });

  // ------------------------------------------------------------------
  // Atomicity: cart tetap utuh saat checkout gagal
  // ------------------------------------------------------------------
  describe("cart tetap utuh saat checkout gagal", () => {
    it("stok habis di tengah -> tidak ada order, cart tidak dikosongkan", async () => {
      const { accessTokenCookie, cart } = await setupCartWithItems([
        { quantity: 5, stock: 3 },
      ]);

      await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      const remaining = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].quantity).toBe(5);
    });
  });

  // ------------------------------------------------------------------
  // Isolasi antar user
  // ------------------------------------------------------------------
  describe("isolasi antar user", () => {
    it("checkout user A tidak menyentuh cart / order milik user B", async () => {
      const userA = await setupCartWithItems([{ quantity: 2 }]);
      const userB = await setupCartWithItems([{ quantity: 3 }]);

      const res = await request(app)
        .post(checkoutEndpoint)
        .set("Cookie", [userA.accessTokenCookie])
        .set("Idempotency-Key", KEY)
        .send(body());

      expect(res.status).toBe(201);

      // Cart user B utuh
      const bItems = await prisma.cartItem.findMany({
        where: { cartId: userB.cart.id },
      });
      expect(bItems).toHaveLength(1);
      expect(bItems[0].quantity).toBe(3);

      // Order user B tidak ada
      const bOrders = await prisma.order.findMany({
        where: { userId: userB.user.id },
      });
      expect(bOrders).toHaveLength(0);
    });

    it("2 user berbeda berebut stok terakhir -> hanya 1 order, stok tidak negatif", async () => {
      const userA = await setupCartWithItems([{ quantity: 1, stock: 1 }]);
      const { variant } = userA.items[0];

      const userB = await getAccesTokenCookie();
      const cartB = await seedCart(userB.user.id);
      await seedCartItem(cartB.id, variant.id, {
        quantity: 1,
        priceAtAdd: "100000.00",
      });

      const [a, b] = await Promise.all([
        request(app)
          .post(checkoutEndpoint)
          .set("Cookie", [userA.accessTokenCookie])
          .set("Idempotency-Key", KEY)
          .send(body()),
        request(app)
          .post(checkoutEndpoint)
          .set("Cookie", [userB.accessTokenCookie])
          .set("Idempotency-Key", KEY)
          .send(body()),
      ]);

      expect([a.status, b.status].sort()).toEqual([201, 400]);
      const loser = a.status === 400 ? a : b;
      expect(loser.body.code).toBe("STOCK_INSUFFICIENT");

      const orders = await prisma.order.count({
        where: { userId: { in: [userA.user.id, userB.user.id] } },
      });
      expect(orders).toBe(1);
      const after = await prisma.productVariant.findUnique({
        where: { id: variant.id },
      });
      expect(after?.stock).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Concurrency
  // ------------------------------------------------------------------
  describe("concurrency", () => {
    it("2 checkout paralel dengan key BERBEDA -> hanya 1 order, yang lain CART_EMPTY", async () => {
      const { accessTokenCookie } = await setupCartWithItems([
        { quantity: 2, stock: 10 },
      ]);

      const [a, b] = await Promise.all([
        request(app)
          .post(checkoutEndpoint)
          .set("Cookie", [accessTokenCookie])
          .set("Idempotency-Key", KEY)
          .send(body()),
        request(app)
          .post(checkoutEndpoint)
          .set("Cookie", [accessTokenCookie])
          .set("Idempotency-Key", KEY_ALT)
          .send(body()),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 400]);

      const loser = a.status === 400 ? a : b;
      expect(loser.body.code).toBe("CART_EMPTY");

      expect(await prisma.order.count()).toBe(1);
    });
  });
});
