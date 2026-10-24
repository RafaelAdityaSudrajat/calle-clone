import { describe, it, expect, vi, beforeEach } from "vitest";
import { removeCartItemService } from "../../../src/modules/cart/cart.service";

/**
 * removeCartItemService menggunakan dua level Prisma:
 *
 * 1. prisma.$transaction:
 *    - tx.cartItem.findFirst untuk mencari cartId milik user.
 *    - tx.$queryRaw untuk lock baris Cart.
 *    - tx.cartItem.deleteMany untuk menghapus item dengan ownership filter.
 *
 * 2. Setelah transaksi commit:
 *    - prisma.cart.findUnique dipanggil oleh getCartService.
 *
 * Unit test ini memverifikasi kontrak query dan urutan operasi.
 * Mock transaksi TIDAK mensimulasikan rollback atau row lock database
 * yang sesungguhnya. Jaminan tersebut tetap harus diuji melalui integration test.
 *
 * vi.hoisted digunakan agar mock tersedia saat factory vi.mock dijalankan.
 */
const mocks = vi.hoisted(() => ({
  tx: {
    cartItem: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
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
const mockDelete = mocks.tx.cartItem.delete;
const mockUpdate = mocks.tx.cartItem.update;
const mockLockCart = mocks.tx.$queryRaw;

const mockGetCartFindUnique = prisma.cart.findUnique as unknown as ReturnType<
  typeof vi.fn
>;

describe("removeCartItemService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Simulasikan interactive transaction dengan tx mock.
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(mocks.tx),
    );

    // Default: item dimiliki user dan berada di cart-1.
    mockFindFirst.mockResolvedValue({
      cartId: "cart-1",
    });

    mockLockCart.mockResolvedValue(undefined);
    mockDeleteMany.mockResolvedValue({ count: 1 });

    // getCartService membaca ulang cart setelah transaksi selesai.
    mockGetCartFindUnique.mockResolvedValue(null);
  });

  // ------------------------------------------------------------------
  // Query contract & anti-IDOR
  // ------------------------------------------------------------------

  describe("ownership dan anti-IDOR", () => {
    it("mencari cartId menggunakan id item dan userId pemilik cart", async () => {
      await removeCartItemService("user-42", "item-1");

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: "item-1",
          cart: { userId: "user-42" },
        },
        select: {
          cartId: true,
        },
      });
    });

    it("menghapus dengan filter id, cartId, dan kepemilikan user", async () => {
      await removeCartItemService("user-42", "item-1");

      expect(mockDeleteMany).toHaveBeenCalledTimes(1);

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          id: "item-1",
          cartId: "cart-1",
          cart: { userId: "user-42" },
        },
      });
    });

    it("tidak menghapus item jika cartItemId tidak ditemukan atau bukan milik user", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(
        removeCartItemService("user-42", "item-x"),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "CART_ITEM_NOT_FOUND",
      });

      expect(mockDeleteMany).not.toHaveBeenCalled();
      expect(mockLockCart).not.toHaveBeenCalled();
      expect(mockGetCartFindUnique).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // Locking
  // ------------------------------------------------------------------

  describe("locking", () => {
    it("mengunci Cart sebelum menghapus CartItem", async () => {
      await removeCartItemService("user-1", "item-1");

      expect(mockFindFirst).toHaveBeenCalledTimes(1);
      expect(mockLockCart).toHaveBeenCalledTimes(1);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);

      // Urutan wajib:
      // cari cartId -> lock Cart -> delete CartItem.
      const findOrder = mockFindFirst.mock.invocationCallOrder[0];

      const lockOrder = mockLockCart.mock.invocationCallOrder[0];

      const deleteOrder = mockDeleteMany.mock.invocationCallOrder[0];

      expect(findOrder).toBeLessThan(lockOrder);
      expect(lockOrder).toBeLessThan(deleteOrder);
    });

    it("hanya mengambil cartId tanpa membaca relasi atau mengecek availability produk", async () => {
      await removeCartItemService("user-1", "item-1");

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: "item-1",
          cart: { userId: "user-1" },
        },
        select: {
          cartId: true,
        },
      });

      expect(mockFindFirst).toHaveBeenCalledTimes(1);

      // Delete tidak perlu memvalidasi status produk atau stok.
      // Produk non-ACTIVE tetap boleh dihapus dari cart.
    });

    it("menggunakan transaksi, bukan operasi Prisma global untuk menghapus item", async () => {
      await removeCartItemService("user-1", "item-1");

      expect(mockTransaction).toHaveBeenCalledTimes(1);

      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // Not found
  // ------------------------------------------------------------------

  describe("not found", () => {
    it("melempar CART_ITEM_NOT_FOUND kalau item hilang sebelum transaksi dapat menghapusnya", async () => {
      mockDeleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        removeCartItemService("user-1", "item-x"),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "CART_ITEM_NOT_FOUND",
      });

      expect(mockGetCartFindUnique).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // Mapping response
  // ------------------------------------------------------------------

  describe("hasil setelah delete", () => {
    it("sukses mengembalikan hasil getCart(userId)", async () => {
      await removeCartItemService("user-1", "item-1");

      expect(mockGetCartFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
        }),
      );
    });

    it("cart tetap ada walau item terakhir dihapus", async () => {
      mockGetCartFindUnique.mockResolvedValueOnce({
        id: "cart-1",
        userId: "user-1",
        cartItems: [],
      });

      const result = await removeCartItemService("user-1", "item-1");

      expect(result).toEqual({
        cart_id: "cart-1",
        items: [],
        total_quantity: 0,
        total_amount: "0.00",
      });
    });

    it("getCart dibaca setelah transaksi selesai, bukan sebelum penghapusan", async () => {
      await removeCartItemService("user-1", "item-1");

      const transactionOrder = mockTransaction.mock.invocationCallOrder[0];

      const readOrder = mockGetCartFindUnique.mock.invocationCallOrder[0];

      expect(transactionOrder).toBeLessThan(readOrder);
    });
  });

  // ------------------------------------------------------------------
  // Database error
  // ------------------------------------------------------------------

  describe("database error", () => {
    it("meneruskan error deleteMany dan tidak membaca ulang cart", async () => {
      const databaseError = new Error("db down");

      mockDeleteMany.mockRejectedValueOnce(databaseError);

      await expect(removeCartItemService("user-1", "item-1")).rejects.toBe(
        databaseError,
      );

      expect(mockGetCartFindUnique).not.toHaveBeenCalled();
    });
  });
});
