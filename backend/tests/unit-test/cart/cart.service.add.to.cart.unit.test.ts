import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { addToCartService } from "../../../src/modules/cart/cart.service";

/**
 * Service addToCartService menyentuh dua "level" Prisma:
 * 1. prisma.$transaction(async (tx) => {...}) -> semua query DI DALAM
 *    callback pakai `tx`, bukan `prisma` langsung.
 * 2. Setelah transaksi commit, service manggil getCart(userId) lagi, yang
 *    pakai prisma.cart.findUnique (bukan tx).
 *
 * Makanya kita butuh DUA mock: txMock (dipakai di dalam $transaction) dan
 * prisma.cart.findUnique (dipakai getCart di akhir).
 */

const txMock = {
  productVariant: { findUnique: vi.fn() },
  cart: { upsert: vi.fn() },
  cartItem: { findUnique: vi.fn(), upsert: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback(txMock),
    ),
    cart: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../../../src/lib/prisma";

const mockTransaction = prisma.$transaction as unknown as ReturnType<
  typeof vi.fn
>;
const mockGetCartFindUnique = prisma.cart.findUnique as unknown as ReturnType<
  typeof vi.fn
>;

// ---------- Helper builder ----------

function buildVariant(
  overrides: {
    stock?: number;
    isActive?: boolean;
    priceOverride?: string | null;
    basePrice?: string;
    productStatus?: string;
    isDeleted?: boolean;
  } = {},
) {
  return {
    id: "variant-1",
    sku: "SKU-001",
    stock: overrides.stock ?? 10,
    isActive: overrides.isActive ?? true,
    priceOverride: overrides.priceOverride
      ? new Prisma.Decimal(overrides.priceOverride)
      : null,
    product: {
      id: "product-1",
      basePrice: new Prisma.Decimal(overrides.basePrice ?? "100000.00"),
      status: overrides.productStatus ?? "ACTIVE",
      isDeleted: overrides.isDeleted ?? false,
    },
  };
}

/** Respon getCart palsu setelah transaksi commit. Isinya tidak terlalu
 * dites detail di sini (sudah dicover test getCart terpisah), cukup
 * dipakai untuk pastikan addToCartService mengembalikan hasil getCart. */
function buildGetCartResult(cartId = "cart-1") {
  return { id: cartId, userId: "user-1", cartItems: [] };
}

describe("addToCartService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(txMock),
    );
    txMock.cart.upsert.mockResolvedValue({ id: "cart-1", userId: "user-1" });
    txMock.$queryRaw.mockResolvedValue(undefined);
    mockGetCartFindUnique.mockResolvedValue(buildGetCartResult());
  });

  it("melempar PRODUCT_NOT_FOUND kalau variant tidak ada", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(null);

    await expect(
      addToCartService("user-1", {
        productVariantId: "variant-x",
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });

    // Cart perlu diambil atau dibuat terlebih dahulu agar bisa dikunci.
    expect(txMock.cart.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1" },
      update: {},
    });

    // Lock harus diperoleh sebelum variant dibaca.
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);

    const cartUpsertOrder = txMock.cart.upsert.mock.invocationCallOrder[0];

    const lockOrder = txMock.$queryRaw.mock.invocationCallOrder[0];

    const variantLookupOrder =
      txMock.productVariant.findUnique.mock.invocationCallOrder[0];

    expect(cartUpsertOrder).toBeLessThan(lockOrder);
    expect(lockOrder).toBeLessThan(variantLookupOrder);

    // Variant tidak ada: jangan lanjut membaca atau mengubah CartItem.
    expect(txMock.cartItem.findUnique).not.toHaveBeenCalled();
    expect(txMock.cartItem.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["produk isDeleted", { isDeleted: true }],
    ["produk status DRAFT", { productStatus: "DRAFT" }],
    ["produk status ARCHIVED", { productStatus: "ARCHIVED" }],
    ["variant isActive false", { isActive: false }],
  ])("melempar PRODUCT_NOT_AVAILABLE kalau %s", async (_label, overrides) => {
    txMock.productVariant.findUnique.mockResolvedValue(buildVariant(overrides));

    await expect(
      addToCartService("user-1", {
        productVariantId: "variant-1",
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "PRODUCT_NOT_AVAILABLE",
    });
  });

  it("melempar STOCK_INSUFFICIENT kalau quantity request > stok, cart item belum ada", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(
      buildVariant({ stock: 5 }),
    );
    txMock.cartItem.findUnique.mockResolvedValue(null);

    await expect(
      addToCartService("user-1", {
        productVariantId: "variant-1",
        quantity: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: "STOCK_INSUFFICIENT" });

    expect(txMock.cartItem.upsert).not.toHaveBeenCalled();
  });

  it("melempar STOCK_INSUFFICIENT berdasarkan quantity AKUMULASI (existing + baru), bukan cuma quantity request", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(
      buildVariant({ stock: 5 }),
    );
    // Sudah ada 3 di cart, stok cuma 5. Request tambah 3 lagi -> 3+3=6 > 5.
    txMock.cartItem.findUnique.mockResolvedValue({ quantity: 3 });

    await expect(
      addToCartService("user-1", {
        productVariantId: "variant-1",
        quantity: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: "STOCK_INSUFFICIENT" });
  });

  it("lolos validasi stok kalau quantity akumulasi PAS SAMA DENGAN stok (boundary)", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(
      buildVariant({ stock: 5 }),
    );
    txMock.cartItem.findUnique.mockResolvedValue({ quantity: 2 });

    await addToCartService("user-1", {
      productVariantId: "variant-1",
      quantity: 3,
    });

    expect(txMock.cartItem.upsert).toHaveBeenCalledTimes(1);
  });

  it("mengunci baris Cart (SELECT ... FOR UPDATE) sebelum baca CartItem", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(buildVariant());
    txMock.cartItem.findUnique.mockResolvedValue(null);

    await addToCartService("user-1", {
      productVariantId: "variant-1",
      quantity: 1,
    });

    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);

    // Urutan call: cart.upsert -> $queryRaw (lock) -> cartItem.findUnique
    const upsertOrder = txMock.cart.upsert.mock.invocationCallOrder[0];
    const lockOrder = txMock.$queryRaw.mock.invocationCallOrder[0];
    const findItemOrder =
      txMock.cartItem.findUnique.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(lockOrder);
    expect(lockOrder).toBeLessThan(findItemOrder);
  });

  it("auto-create cart lewat upsert dengan where.userId yang benar", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(buildVariant());
    txMock.cartItem.findUnique.mockResolvedValue(null);

    await addToCartService("user-42", {
      productVariantId: "variant-1",
      quantity: 1,
    });

    expect(txMock.cart.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-42" },
        create: { userId: "user-42" },
      }),
    );
  });

  it("item baru -> create berisi priceAtAdd dari harga efektif saat ini", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(
      buildVariant({ basePrice: "120000.00", priceOverride: null }),
    );
    txMock.cartItem.findUnique.mockResolvedValue(null);

    await addToCartService("user-1", {
      productVariantId: "variant-1",
      quantity: 2,
    });

    expect(txMock.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cartId: "cart-1",
          productVariantId: "variant-1",
          quantity: 2,
          priceAtAdd: expect.objectContaining({
            // Prisma.Decimal punya method toString/toFixed, bukan primitive
            // jadi dibandingkan lewat .toFixed, bukan toEqual langsung.
          }),
        }),
      }),
    );

    const callArg = txMock.cartItem.upsert.mock.calls[0][0];
    expect((callArg.create.priceAtAdd as Prisma.Decimal).toFixed(2)).toBe(
      "120000.00",
    );
  });

  it("item baru -> priceAtAdd pakai priceOverride kalau ada, bukan basePrice", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(
      buildVariant({ basePrice: "120000.00", priceOverride: "90000.00" }),
    );
    txMock.cartItem.findUnique.mockResolvedValue(null);

    await addToCartService("user-1", {
      productVariantId: "variant-1",
      quantity: 1,
    });

    const callArg = txMock.cartItem.upsert.mock.calls[0][0];
    expect((callArg.create.priceAtAdd as Prisma.Decimal).toFixed(2)).toBe(
      "90000.00",
    );
  });

  it("item sudah ada -> update pakai atomic increment, priceAtAdd TIDAK ikut dikirim", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(buildVariant());
    txMock.cartItem.findUnique.mockResolvedValue({ quantity: 2 });

    await addToCartService("user-1", {
      productVariantId: "variant-1",
      quantity: 3,
    });

    const callArg = txMock.cartItem.upsert.mock.calls[0][0];
    expect(callArg.update).toEqual({ quantity: { increment: 3 } });
    expect(callArg.update.priceAtAdd).toBeUndefined();
  });

  it("where upsert cartItem pakai compound key cartId_productVariantId", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(buildVariant());
    txMock.cartItem.findUnique.mockResolvedValue(null);

    await addToCartService("user-1", {
      productVariantId: "variant-1",
      quantity: 1,
    });

    const callArg = txMock.cartItem.upsert.mock.calls[0][0];
    expect(callArg.where).toEqual({
      cartId_productVariantId: {
        cartId: "cart-1",
        productVariantId: "variant-1",
      },
    });
  });

  it("sukses -> mengembalikan hasil getCart(userId) setelah transaksi commit", async () => {
    txMock.productVariant.findUnique.mockResolvedValue(buildVariant());
    txMock.cartItem.findUnique.mockResolvedValue(null);
    mockGetCartFindUnique.mockResolvedValue(null); // cart kosong versi getCart

    const result = await addToCartService("user-1", {
      productVariantId: "variant-1",
      quantity: 1,
    });

    expect(mockGetCartFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(result.cart_id).toBeNull(); // sesuai mock getCart di atas
  });
});
