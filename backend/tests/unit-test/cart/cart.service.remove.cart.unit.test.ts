import { describe, it, expect, vi, beforeEach } from "vitest";
import { removeCartItemService } from "../../../src/modules/cart/cart.service";

/**
 * removeCartItemService cuma memakai deleteMany (cek kepemilikan + hapus dalam
 * satu query) lalu getCart. findFirst/delete/update sengaja ikut di-mock supaya
 * bisa di-assert TIDAK dipanggil.
 */
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    cartItem: {
      findFirst: vi.fn(),
      delete: vi.fn(),
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
const mockDelete = prisma.cartItem.delete as unknown as ReturnType<
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

describe("removeCartItemService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ count: 1 });
    mockGetCartFindUnique.mockResolvedValue(null);
  });

  it("menghapus lewat deleteMany dengan filter id DAN cart.userId sekaligus (anti-IDOR)", async () => {
    await removeCartItemService("user-42", "item-1");

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: "item-1", cart: { userId: "user-42" } },
    });
  });

  it("hanya memakai deleteMany: tidak ada lookup (findFirst), delete biasa, atau update", async () => {
    await removeCartItemService("user-1", "item-1");

    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("melempar CART_ITEM_NOT_FOUND (404) kalau tidak ada yang terhapus (item tidak ada / milik user lain)", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    await expect(
      removeCartItemService("user-1", "item-x"),
    ).rejects.toMatchObject({ statusCode: 404, code: "CART_ITEM_NOT_FOUND" });
  });

  it("kalau tidak ada yang terhapus, getCart TIDAK dipanggil", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    await expect(
      removeCartItemService("user-1", "item-x"),
    ).rejects.toBeTruthy();

    expect(mockGetCartFindUnique).not.toHaveBeenCalled();
  });

  it("sukses -> mengembalikan hasil getCart(userId), bukan data custom lain", async () => {
    mockGetCartFindUnique.mockResolvedValue(null);

    const result = await removeCartItemService("user-1", "item-1");

    expect(mockGetCartFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(result.cart_id).toBeNull();
  });

  it("cart tetap ada walau item terakhir dihapus (cart_id tetap, items kosong)", async () => {
    mockGetCartFindUnique.mockResolvedValue({
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

  it("getCart dibaca SETELAH penghapusan, bukan sebelumnya", async () => {
    await removeCartItemService("user-1", "item-1");

    const deleteOrder = mockDeleteMany.mock.invocationCallOrder[0];
    const readOrder = mockGetCartFindUnique.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(readOrder);
  });

  it("error dari database diteruskan apa adanya, dan getCart tidak dipanggil", async () => {
    mockDeleteMany.mockRejectedValue(new Error("db down"));

    await expect(removeCartItemService("user-1", "item-1")).rejects.toThrow(
      "db down",
    );

    expect(mockGetCartFindUnique).not.toHaveBeenCalled();
  });
});
