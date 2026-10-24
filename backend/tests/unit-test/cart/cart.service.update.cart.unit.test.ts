import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateCartItemService } from "../../../src/modules/cart/cart.service";

const mocks = vi.hoisted(() => ({
  tx: {
    cartItem: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
  transaction: vi.fn(),
  cartFindUnique: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    cart: {
      findUnique: mocks.cartFindUnique,
    },
  },
}));

import { prisma } from "../../../src/lib/prisma";

const mockTransaction = prisma.$transaction as unknown as ReturnType<
  typeof vi.fn
>;

const mockFindFirst = mocks.tx.cartItem.findFirst;
const mockDeleteMany = mocks.tx.cartItem.deleteMany;
const mockUpdateMany = mocks.tx.cartItem.updateMany;

const mockGetCartFindUnique = prisma.cart.findUnique as unknown as ReturnType<
  typeof vi.fn
>;

function buildOwnedItem(
  overrides: {
    id?: string;
    stock?: number;
    isVariantActive?: boolean;
    productStatus?: string;
    isDeleted?: boolean;
  } = {},
) {
  return {
    id: overrides.id ?? "item-1",
    quantity: 2,
    productVariant: {
      id: "variant-1",
      stock: overrides.stock ?? 10,
      isActive: overrides.isVariantActive ?? true,
      product: {
        id: "product-1",
        status: overrides.productStatus ?? "ACTIVE",
        isDeleted: overrides.isDeleted ?? false,
      },
    },
  };
}

function mockExistingOwnedItem(
  overrides: Parameters<typeof buildOwnedItem>[0] = {},
) {
  mockFindFirst
    .mockResolvedValueOnce({ cartId: "cart-1" })
    .mockResolvedValueOnce(buildOwnedItem(overrides));
}

describe("updateCartItemService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Simulasikan transaksi dengan menjalankan callback memakai tx mock.
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(mocks.tx),
    );

    mocks.tx.$queryRaw.mockResolvedValue(undefined);

    // Default untuk menemukan Cart milik user.
    mockFindFirst.mockResolvedValue({
      cartId: "cart-1",
    });

    mockDeleteMany.mockResolvedValue({ count: 1 });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    // getCartService dipanggil setelah transaksi selesai.
    mockGetCartFindUnique.mockResolvedValue(null);
  });

  it("melempar CART_ITEM_NOT_FOUND kalau item tidak ada / bukan milik user", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      updateCartItemService("user-1", "item-x", { quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 404, code: "CART_ITEM_NOT_FOUND" });

    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("query findFirst memfilter id DAN cart.userId sekaligus (anti-IDOR)", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      updateCartItemService("user-42", "item-1", { quantity: 1 }),
    ).rejects.toBeTruthy();

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1", cart: { userId: "user-42" } },
      }),
    );
  });

  describe("quantity = 0 (delete, didelegasikan ke removeCartItem)", () => {
    it("menghapus lewat deleteMany dengan filter id + cart.userId, lalu mengembalikan hasil getCart", async () => {
      await updateCartItemService("user-1", "item-1", { quantity: 0 });

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          id: "item-1",
          cartId: "cart-1",
          cart: { userId: "user-1" },
        },
      });
      expect(mockUpdateMany).not.toHaveBeenCalled();
      expect(mockGetCartFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1" } }),
      );
    });

    it("mengambil cartId untuk locking tanpa memvalidasi availability produk", async () => {
      mockFindFirst.mockResolvedValueOnce({ cartId: "cart-1" });
      mockDeleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        updateCartItemService("user-1", "item-x", {
          quantity: 0,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "CART_ITEM_NOT_FOUND",
      });
    });

    it("melempar CART_ITEM_NOT_FOUND kalau tidak ada yang terhapus (item tidak ada / milik user lain)", async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 });

      await expect(
        updateCartItemService("user-1", "item-x", { quantity: 0 }),
      ).rejects.toMatchObject({ statusCode: 404, code: "CART_ITEM_NOT_FOUND" });
    });
  });

  describe("quantity > 0 (update)", () => {
    it.each([
      ["produk isDeleted", { isDeleted: true }],
      ["produk status DRAFT", { productStatus: "DRAFT" }],
      ["produk status ARCHIVED", { productStatus: "ARCHIVED" }],
      ["variant isActive false", { isVariantActive: false }],
    ])("melempar PRODUCT_NOT_AVAILABLE kalau %s", async (_label, overrides) => {
      mockFindFirst.mockResolvedValue(buildOwnedItem(overrides));

      await expect(
        updateCartItemService("user-1", "item-1", { quantity: 3 }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "PRODUCT_NOT_AVAILABLE",
      });

      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("melempar STOCK_INSUFFICIENT kalau quantity baru melebihi stok", async () => {
      mockExistingOwnedItem({ stock: 5 });
      await expect(
        updateCartItemService("user-1", "item-1", { quantity: 6 }),
      ).rejects.toMatchObject({ statusCode: 400, code: "STOCK_INSUFFICIENT" });

      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("lolos validasi stok kalau quantity PAS SAMA DENGAN stok (boundary)", async () => {
      mockExistingOwnedItem({ stock: 5 });
      await updateCartItemService("user-1", "item-1", { quantity: 5 });

      expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    });

    it("update bersifat ABSOLUTE SET, bukan increment, dan priceAtAdd tidak ikut dikirim", async () => {
      mockExistingOwnedItem({ stock: 10 });

      await updateCartItemService("user-1", "item-1", {
        quantity: 7,
      });

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          id: "item-1",
          cartId: "cart-1",
          cart: { userId: "user-1" },
        },
        data: { quantity: 7 },
      });
    });

    it("validasi stok memakai quantity dari request langsung, BUKAN akumulasi dengan quantity lama", async () => {
      // quantity lama di cart = 2 (dari buildOwnedItem), stok = 5.
      // Kalau salah diakumulasi (2 + 4 = 6 > 5) harusnya gagal, tapi
      // seharusnya LOLOS karena update itu absolute (quantity baru = 4 <= 5).
      mockExistingOwnedItem({ stock: 5 });
      await updateCartItemService("user-1", "item-1", { quantity: 4 });

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          id: "item-1",
          cartId: "cart-1",
          cart: { userId: "user-1" },
        },
        data: { quantity: 4 },
      });
    });

    it("melempar CART_ITEM_NOT_FOUND jika updateMany tidak mengubah baris", async () => {
      mockExistingOwnedItem();

      mockUpdateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        updateCartItemService("user-1", "item-1", {
          quantity: 3,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "CART_ITEM_NOT_FOUND",
      });

      expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    });
  });

  it("sukses -> mengembalikan hasil getCart(userId), bukan data custom lain", async () => {
    mockFindFirst.mockResolvedValue(buildOwnedItem());
    mockGetCartFindUnique.mockResolvedValue(null);

    const result = await updateCartItemService("user-1", "item-1", {
      quantity: 3,
    });

    expect(mockGetCartFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(result.cart_id).toBeNull();
  });
});
