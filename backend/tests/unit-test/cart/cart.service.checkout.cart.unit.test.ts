import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { checkoutService } from "../../../src/modules/cart/cart.service";

/**
 * checkoutService hanya bekerja di dalam prisma.$transaction(async (tx) => ...),
 * dan tidak memanggil getCart() di akhir. Jadi cukup satu mock: `tx`.
 * vi.hoisted dipakai supaya `tx` sudah ada saat factory vi.mock (yang di-hoist) jalan.
 */
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  tx: {
    cart: { findUnique: vi.fn(), delete: vi.fn() },
    cartItem: { findMany: vi.fn(), deleteMany: vi.fn() },
    productVariant: { updateMany: vi.fn(), findUnique: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

const { tx } = mocks;

// ---------- Builder ----------

const KEY = "11111111-1111-4111-8111-111111111111";

function input(overrides: { confirmPriceChange?: boolean } = {}) {
  return {
    shippingAddress: {
      recipientName: "Budi Santoso",
      phone: "081234567890",
      addressLine: "Jl. Contoh No. 1",
      city: "Bandung",
      postalCode: "40111",
    },
    confirmPriceChange: overrides.confirmPriceChange ?? false,
    idempotencyKey: KEY,
  };
}

function buildCartItem(
  o: {
    variantId?: string;
    sku?: string;
    productName?: string;
    quantity?: number;
    stock?: number;
    priceAtAdd?: string;
    basePrice?: string;
    priceOverride?: string | null;
    isVariantActive?: boolean;
    productStatus?: string;
    isDeleted?: boolean;
  } = {},
) {
  const variantId = o.variantId ?? "variant-1";
  return {
    id: `item-${variantId}`,
    cartId: "cart-1",
    quantity: o.quantity ?? 2,
    priceAtAdd: new Prisma.Decimal(o.priceAtAdd ?? "100000.00"),
    createdAt: new Date("2026-10-01T00:00:00Z"),
    productVariant: {
      id: variantId,
      sku: o.sku ?? "SKU-001",
      stock: o.stock ?? 10,
      isActive: o.isVariantActive ?? true,
      priceOverride: o.priceOverride
        ? new Prisma.Decimal(o.priceOverride)
        : null,
      product: {
        id: "product-1",
        name: o.productName ?? "Oversized Tee",
        basePrice: new Prisma.Decimal(o.basePrice ?? "100000.00"),
        status: o.productStatus ?? "ACTIVE",
        isDeleted: o.isDeleted ?? false,
      },
    },
  };
}

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    status: "PENDING_PAYMENT",
    paymentStatus: "UNPAID",
    totalAmount: new Prisma.Decimal("200000.00"),
    createdAt: new Date("2026-10-13T12:00:00.000Z"),
    items: [
      {
        id: "oi-1",
        productVariantId: "variant-1",
        productName: "Oversized Tee",
        variantSku: "SKU-001",
        unitPrice: new Prisma.Decimal("100000.00"),
        quantity: 2,
        subtotal: new Prisma.Decimal("200000.00"),
      },
    ],
    ...overrides,
  };
}

function expectNoWrites() {
  expect(tx.productVariant.updateMany).not.toHaveBeenCalled();
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
}

describe("checkoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (cb: (t: unknown) => unknown) =>
      cb(tx),
    );
    tx.cart.findUnique.mockResolvedValue({ id: "cart-1" });
    tx.$queryRaw.mockResolvedValue(undefined);
    tx.order.findUnique.mockResolvedValue(null); // default: bukan replay
    tx.cartItem.findMany.mockResolvedValue([buildCartItem()]);
    tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue(buildOrder());
    tx.cartItem.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("seluruh proses berjalan di dalam satu prisma.$transaction", async () => {
    await checkoutService("user-1", input());

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  describe("idempotency replay", () => {
    it("key sudah punya order -> kembalikan order itu dengan idempotent_replay true, tanpa menulis apa pun", async () => {
      tx.order.findUnique.mockResolvedValue(
        buildOrder({ id: "order-existing" }),
      );

      const result = await checkoutService("user-1", input());

      expect(result.order_id).toBe("order-existing");
      expect(result.idempotent_replay).toBe(true);
      expect(tx.cartItem.findMany).not.toHaveBeenCalled();
      expectNoWrites();
    });

    it("lookup memakai compound key (userId + idempotencyKey), jadi key yang sama dari user lain tidak bentrok", async () => {
      await checkoutService("user-42", input());

      expect(tx.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_idempotencyKey: { userId: "user-42", idempotencyKey: KEY },
          },
        }),
      );
    });

    it("urutan: cart dibaca -> cart dikunci (FOR UPDATE) -> baru cek replay", async () => {
      await checkoutService("user-1", input());

      const cartRead = tx.cart.findUnique.mock.invocationCallOrder[0];
      const lock = tx.$queryRaw.mock.invocationCallOrder[0];
      const replayCheck = tx.order.findUnique.mock.invocationCallOrder[0];
      expect(cartRead).toBeLessThan(lock);
      expect(lock).toBeLessThan(replayCheck);
    });
  });

  describe("cart kosong", () => {
    it("CART_EMPTY (400) kalau user belum punya cart, dan tidak ada lock", async () => {
      tx.cart.findUnique.mockResolvedValue(null);

      await expect(checkoutService("user-1", input())).rejects.toMatchObject({
        statusCode: 400,
        code: "CART_EMPTY",
      });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expectNoWrites();
    });

    it("CART_EMPTY (400) kalau cart ada tapi tidak punya item", async () => {
      tx.cartItem.findMany.mockResolvedValue([]);

      await expect(checkoutService("user-1", input())).rejects.toMatchObject({
        statusCode: 400,
        code: "CART_EMPTY",
      });
      expectNoWrites();
    });
  });

  describe("validasi item (all-or-nothing)", () => {
    it.each([
      ["produk isDeleted", { isDeleted: true }],
      ["produk status DRAFT", { productStatus: "DRAFT" }],
      ["produk status ARCHIVED", { productStatus: "ARCHIVED" }],
      ["variant isActive false", { isVariantActive: false }],
    ])("PRODUCT_NOT_AVAILABLE (400) kalau %s", async (_label, overrides) => {
      tx.cartItem.findMany.mockResolvedValue([buildCartItem(overrides)]);

      await expect(checkoutService("user-1", input())).rejects.toMatchObject({
        statusCode: 400,
        code: "PRODUCT_NOT_AVAILABLE",
      });
      expectNoWrites();
    });

    it("STOCK_INSUFFICIENT (400) kalau quantity di cart melebihi stok", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({ quantity: 5, stock: 3 }),
      ]);

      await expect(checkoutService("user-1", input())).rejects.toMatchObject({
        statusCode: 400,
        code: "STOCK_INSUFFICIENT",
      });
      expectNoWrites();
    });

    it("lolos kalau quantity PAS SAMA DENGAN stok (boundary)", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({ quantity: 3, stock: 3 }),
      ]);

      await checkoutService("user-1", input());

      expect(tx.order.create).toHaveBeenCalledTimes(1);
    });

    it("satu item bermasalah menolak SEMUA, tidak ada stok yang sempat dikurangi", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({ variantId: "variant-1" }),
        buildCartItem({ variantId: "variant-2", stock: 0 }),
      ]);

      await expect(checkoutService("user-1", input())).rejects.toMatchObject({
        code: "STOCK_INSUFFICIENT",
      });
      expectNoWrites();
    });
  });

  describe("perubahan harga", () => {
    it("PRICE_CHANGED (409) kalau harga sekarang beda dari price_at_add dan belum dikonfirmasi", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({ priceAtAdd: "100000.00", basePrice: "120000.00" }),
      ]);

      await expect(checkoutService("user-1", input())).rejects.toMatchObject({
        statusCode: 409,
        code: "PRICE_CHANGED",
      });
      expectNoWrites();
    });

    it("harga yang sama TIDAK memicu PRICE_CHANGED", async () => {
      await checkoutService("user-1", input());

      expect(tx.order.create).toHaveBeenCalledTimes(1);
    });

    it("confirmPriceChange true -> lanjut, dan order memakai harga TERBARU (dibekukan)", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({
          quantity: 2,
          priceAtAdd: "100000.00",
          basePrice: "120000.00",
        }),
      ]);

      await checkoutService("user-1", input({ confirmPriceChange: true }));

      const { data } = tx.order.create.mock.calls[0][0];
      expect(data.items.create[0].unitPrice.toFixed(2)).toBe("120000.00");
      expect(data.items.create[0].subtotal.toFixed(2)).toBe("240000.00");
      expect(data.totalAmount.toFixed(2)).toBe("240000.00");
    });

    it("priceOverride dipakai sebagai harga, bukan basePrice", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({
          basePrice: "120000.00",
          priceOverride: "90000.00",
          priceAtAdd: "90000.00",
        }),
      ]);

      await checkoutService("user-1", input());

      const { data } = tx.order.create.mock.calls[0][0];
      expect(data.items.create[0].unitPrice.toFixed(2)).toBe("90000.00");
    });

    it("item tidak tersedia dilaporkan DULU sebelum harga (PRODUCT_NOT_AVAILABLE, bukan PRICE_CHANGED)", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({
          productStatus: "ARCHIVED",
          priceAtAdd: "100000.00",
          basePrice: "120000.00",
        }),
      ]);

      await expect(checkoutService("user-1", input())).rejects.toMatchObject({
        code: "PRODUCT_NOT_AVAILABLE",
      });
    });
  });

  describe("pengurangan stok", () => {
    it("update kondisional per variant: where stock >= qty, data decrement qty", async () => {
      tx.cartItem.findMany.mockResolvedValue([buildCartItem({ quantity: 2 })]);

      await checkoutService("user-1", input());

      expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
        where: { id: "variant-1", stock: { gte: 2 } },
        data: { stock: { decrement: 2 } },
      });
    });

    it("variant diproses berurutan menurut id (cegah deadlock), apa pun urutan di cart", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({ variantId: "variant-b" }),
        buildCartItem({ variantId: "variant-a" }),
      ]);

      await checkoutService("user-1", input());

      const ids = tx.productVariant.updateMany.mock.calls.map(
        (c: { where: { id: string } }[]) => c[0].where.id,
      );
      expect(ids).toEqual(["variant-a", "variant-b"]);
    });

    it("update kondisional kalah balapan (count 0) -> STOCK_INSUFFICIENT dengan stok terbaru, order tidak dibuat", async () => {
      tx.productVariant.updateMany.mockResolvedValue({ count: 0 });
      tx.productVariant.findUnique.mockResolvedValue({ stock: 1 });

      await expect(checkoutService("user-1", input())).rejects.toMatchObject({
        statusCode: 400,
        code: "STOCK_INSUFFICIENT",
        message: "Insufficient stock",
      });
      expect(tx.order.create).not.toHaveBeenCalled();
      expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("pembuatan order & pengosongan cart", () => {
    it("order dibuat dengan snapshot alamat, idempotencyKey, dan snapshot item", async () => {
      await checkoutService("user-7", input());

      const { data } = tx.order.create.mock.calls[0][0];
      expect(data).toMatchObject({
        userId: "user-7",
        idempotencyKey: KEY,
        shippingRecipientName: "Budi Santoso",
        shippingPhone: "081234567890",
        shippingAddressLine: "Jl. Contoh No. 1",
        shippingCity: "Bandung",
        shippingPostalCode: "40111",
      });
      expect(data.items.create[0]).toMatchObject({
        productVariantId: "variant-1",
        productName: "Oversized Tee",
        variantSku: "SKU-001",
        quantity: 2,
      });
    });

    it("total_amount = jumlah subtotal semua item", async () => {
      tx.cartItem.findMany.mockResolvedValue([
        buildCartItem({
          variantId: "variant-1",
          quantity: 2,
          basePrice: "100000.00",
        }),
        buildCartItem({
          variantId: "variant-2",
          quantity: 3,
          basePrice: "50000.00",
          priceAtAdd: "50000.00",
        }),
      ]);

      await checkoutService("user-1", input());

      const { data } = tx.order.create.mock.calls[0][0];
      expect(data.totalAmount.toFixed(2)).toBe("350000.00"); // 200000 + 150000
    });

    it("cart dikosongkan SETELAH order dibuat, dan cart-nya sendiri tidak dihapus", async () => {
      await checkoutService("user-1", input());

      expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: "cart-1" },
      });
      expect(tx.cart.delete).not.toHaveBeenCalled();

      const created = tx.order.create.mock.invocationCallOrder[0];
      const cleared = tx.cartItem.deleteMany.mock.invocationCallOrder[0];
      expect(created).toBeLessThan(cleared);
    });

    it("kalau pembuatan order gagal, cart TIDAK dikosongkan dan error diteruskan", async () => {
      tx.order.create.mockRejectedValue(new Error("db down"));

      await expect(checkoutService("user-1", input())).rejects.toThrow(
        "db down",
      );
      expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
    });
  });

  it("sukses -> DTO benar, idempotent_replay false", async () => {
    const result = await checkoutService("user-1", input());

    expect(result).toEqual({
      order_id: "order-1",
      status: "PENDING_PAYMENT",
      payment_status: "UNPAID",
      total_amount: "200000.00",
      items: [
        {
          id: "oi-1",
          product_variant_id: "variant-1",
          product_name: "Oversized Tee",
          variant_sku: "SKU-001",
          unit_price: "100000.00",
          quantity: 2,
          subtotal: "200000.00",
        },
      ],
      created_at: "2026-10-13T12:00:00.000Z",
      idempotent_replay: false,
    });
  });
});
