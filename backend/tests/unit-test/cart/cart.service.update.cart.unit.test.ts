import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateCartItemService } from "../../../src/modules/cart/cart.service";

/**
 * updateCartItemService TIDAK pakai $transaction (beda dengan addToCart), karena
 * update bersifat absolute set, bukan increment -> tidak ada race read-modify-
 * write yang perlu dikunci. Jadi cukup mock prisma langsung, tanpa txMock.
 */
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    cartItem: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    cart: {
      findUnique: vi.fn(), // dipakai getCart() di akhir
    },
  },
}));

import { prisma } from "../../../src/lib/prisma";

const mockFindFirst = prisma.cartItem.findFirst as unknown as ReturnType<
  typeof vi.fn
>;
const mockDeleteMany = prisma.cartItem.deleteMany as unknown as ReturnType<
  typeof vi.fn
>;
const mockUpdate = prisma.cartItem.update as unknown as ReturnType<
  typeof vi.fn
>;
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

describe("updateCartItemService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCartFindUnique.mockResolvedValue(null); // isi detail getCart tidak relevan di sini
    mockDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("melempar CART_ITEM_NOT_FOUND kalau item tidak ada / bukan milik user", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      updateCartItemService("user-1", "item-x", { quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 404, code: "CART_ITEM_NOT_FOUND" });

    expect(mockUpdate).not.toHaveBeenCalled();
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
        where: { id: "item-1", cart: { userId: "user-1" } },
      });
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockGetCartFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1" } }),
      );
    });

    it("tidak melakukan lookup item maupun cek availability, jadi produk ARCHIVED / stok 0 tetap bisa dihapus", async () => {
      await updateCartItemService("user-1", "item-1", { quantity: 0 });

      expect(mockFindFirst).not.toHaveBeenCalled();
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
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

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("melempar STOCK_INSUFFICIENT kalau quantity baru melebihi stok", async () => {
      mockFindFirst.mockResolvedValue(buildOwnedItem({ stock: 5 }));

      await expect(
        updateCartItemService("user-1", "item-1", { quantity: 6 }),
      ).rejects.toMatchObject({ statusCode: 400, code: "STOCK_INSUFFICIENT" });

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("lolos validasi stok kalau quantity PAS SAMA DENGAN stok (boundary)", async () => {
      mockFindFirst.mockResolvedValue(buildOwnedItem({ stock: 5 }));

      await updateCartItemService("user-1", "item-1", { quantity: 5 });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("update bersifat ABSOLUTE SET, bukan increment, dan priceAtAdd tidak ikut dikirim", async () => {
      mockFindFirst.mockResolvedValue(buildOwnedItem({ stock: 10 })); // quantity lama = 2

      await updateCartItemService("user-1", "item-1", { quantity: 7 });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { quantity: 7 }, // absolute, bukan { increment: 7 }
      });
    });

    it("validasi stok memakai quantity dari request langsung, BUKAN akumulasi dengan quantity lama", async () => {
      // quantity lama di cart = 2 (dari buildOwnedItem), stok = 5.
      // Kalau salah diakumulasi (2 + 4 = 6 > 5) harusnya gagal, tapi
      // seharusnya LOLOS karena update itu absolute (quantity baru = 4 <= 5).
      mockFindFirst.mockResolvedValue(buildOwnedItem({ stock: 5 }));

      await updateCartItemService("user-1", "item-1", { quantity: 4 });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { quantity: 4 },
      });
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
