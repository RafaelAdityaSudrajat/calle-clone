import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { getCartService } from "../../../src/modules/cart/cart.service";

// Mock modul singleton Prisma, bukan PrismaClient class, karena service
// meng-import `{ prisma }` langsung dari "../../lib/prisma".
vi.mock("../../../src/lib/prisma.ts", () => ({
  prisma: {
    cart: {
      findUnique: vi.fn(),
    },
  },
}));

// Import SETELAH vi.mock, supaya ambil versi yang sudah di-mock.
import { prisma } from "../../../src/lib/prisma";

const mockFindUnique = prisma.cart.findUnique as unknown as ReturnType<
  typeof vi.fn
>;

/**
 * Helper bikin satu CartItem + relasi lengkap, dengan default "normal"
 * (produk ACTIVE, variant aktif, stok ada). Override lewat parameter
 * sesuai skenario yang mau ditest.
 */
function buildCartItem(overrides: {
  id?: string;
  quantity?: number;
  priceAtAdd?: string;
  basePrice?: string;
  priceOverride?: string | null;
  stock?: number;
  isVariantActive?: boolean;
  productStatus?: string;
  isDeleted?: boolean;
  isPrimaryImage?: boolean;
}) {
  return {
    id: overrides.id ?? "item-1",
    quantity: overrides.quantity ?? 2,
    priceAtAdd: new Prisma.Decimal(overrides.priceAtAdd ?? "100000.00"),
    createdAt: new Date("2026-09-01T00:00:00Z"),
    productVariant: {
      id: "variant-1",
      sku: "SKU-001",
      size: "M",
      color: "Black",
      stock: overrides.stock ?? 10,
      isActive: overrides.isVariantActive ?? true,
      priceOverride: overrides.priceOverride
        ? new Prisma.Decimal(overrides.priceOverride)
        : null,
      product: {
        id: "product-1",
        name: "Oversized Tee",
        slug: "oversized-tee",
        basePrice: new Prisma.Decimal(overrides.basePrice ?? "100000.00"),
        status: overrides.productStatus ?? "ACTIVE",
        isDeleted: overrides.isDeleted ?? false,
        images:
          overrides.isPrimaryImage === false
            ? []
            : [{ url: "https://example.com/tee.jpg" }],
      },
    },
  };
}

function buildCart(cartItems: ReturnType<typeof buildCartItem>[]) {
  return { id: "cart-1", userId: "user-1", cartItems };
}

describe("getCartService", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it("mengembalikan cart_id null dan items kosong kalau cart belum pernah dibuat", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getCartService("user-1");

    expect(result).toEqual({
      cart_id: null,
      items: [],
      total_quantity: 0,
      total_amount: "0.00",
    });
  });

  it("memanggil findUnique dengan where.userId yang benar (anti-IDOR)", async () => {
    mockFindUnique.mockResolvedValue(null);

    await getCartService("user-42");

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-42" },
      }),
    );
  });

  it("menghitung subtotal, total_quantity, dan total_amount dengan benar untuk item yang tersedia", async () => {
    mockFindUnique.mockResolvedValue(
      buildCart([
        buildCartItem({ id: "item-1", quantity: 2, basePrice: "100000.00" }),
        buildCartItem({ id: "item-2", quantity: 3, basePrice: "50000.00" }),
      ]),
    );

    const result = await getCartService("user-1");

    expect(result.cart_id).toBe("cart-1");
    expect(result.items).toHaveLength(2);
    expect(result.items[0].subtotal).toBe("200000.00"); // 100000 * 2
    expect(result.items[1].subtotal).toBe("150000.00"); // 50000 * 3
    expect(result.total_quantity).toBe(5); // 2 + 3
    expect(result.total_amount).toBe("350000.00"); // 200000 + 150000
  });

  it("memakai priceOverride sebagai unit_price kalau ada, bukan basePrice", async () => {
    mockFindUnique.mockResolvedValue(
      buildCart([
        buildCartItem({ basePrice: "100000.00", priceOverride: "80000.00" }),
      ]),
    );

    const result = await getCartService("user-1");

    expect(result.items[0].unit_price).toBe("80000.00");
  });

  it("mendeteksi price_changed = true kalau unit_price beda dari price_at_add", async () => {
    mockFindUnique.mockResolvedValue(
      buildCart([
        buildCartItem({ priceAtAdd: "100000.00", basePrice: "120000.00" }),
      ]),
    );

    const result = await getCartService("user-1");

    expect(result.items[0].price_changed).toBe(true);
    expect(result.items[0].price_at_add).toBe("100000.00");
    expect(result.items[0].unit_price).toBe("120000.00");
  });

  it("price_changed = false kalau harga tidak berubah sejak ditambahkan", async () => {
    mockFindUnique.mockResolvedValue(
      buildCart([
        buildCartItem({ priceAtAdd: "100000.00", basePrice: "100000.00" }),
      ]),
    );

    const result = await getCartService("user-1");

    expect(result.items[0].price_changed).toBe(false);
  });

  describe("unavailable_reason", () => {
    it("PRODUCT_DELETED kalau product.isDeleted true, meski status masih ACTIVE", async () => {
      mockFindUnique.mockResolvedValue(
        buildCart([
          buildCartItem({ isDeleted: true, productStatus: "ACTIVE" }),
        ]),
      );

      const result = await getCartService("user-1");

      expect(result.items[0].is_available).toBe(false);
      expect(result.items[0].unavailable_reason).toBe("PRODUCT_DELETED");
    });

    it("PRODUCT_NOT_ACTIVE kalau status DRAFT", async () => {
      mockFindUnique.mockResolvedValue(
        buildCart([buildCartItem({ productStatus: "DRAFT" })]),
      );
      expect((await getCartService("user-1")).items[0].unavailable_reason).toBe(
        "PRODUCT_NOT_ACTIVE",
      );
    });

    it("PRODUCT_NOT_ACTIVE kalau status OUT_OF_STOCK di level produk (keputusan admin)", async () => {
      mockFindUnique.mockResolvedValue(
        buildCart([buildCartItem({ productStatus: "OUT_OF_STOCK" })]),
      );
      expect((await getCartService("user-1")).items[0].unavailable_reason).toBe(
        "PRODUCT_NOT_ACTIVE",
      );
    });

    it("PRODUCT_NOT_ACTIVE kalau status ARCHIVED", async () => {
      mockFindUnique.mockResolvedValue(
        buildCart([buildCartItem({ productStatus: "ARCHIVED" })]),
      );
      expect((await getCartService("user-1")).items[0].unavailable_reason).toBe(
        "PRODUCT_NOT_ACTIVE",
      );
    });

    it("VARIANT_INACTIVE kalau variant.isActive false meski produk ACTIVE", async () => {
      mockFindUnique.mockResolvedValue(
        buildCart([buildCartItem({ isVariantActive: false })]),
      );
      expect((await getCartService("user-1")).items[0].unavailable_reason).toBe(
        "VARIANT_INACTIVE",
      );
    });

    it("OUT_OF_STOCK kalau stock variant 0 (dihitung sistem, bukan status admin)", async () => {
      mockFindUnique.mockResolvedValue(
        buildCart([buildCartItem({ stock: 0 })]),
      );
      expect((await getCartService("user-1")).items[0].unavailable_reason).toBe(
        "OUT_OF_STOCK",
      );
    });

    it("is_available true dan unavailable_reason null kalau semua syarat terpenuhi", async () => {
      mockFindUnique.mockResolvedValue(buildCart([buildCartItem({})]));

      const result = await getCartService("user-1");

      expect(result.items[0].is_available).toBe(true);
      expect(result.items[0].unavailable_reason).toBeNull();
    });
  });

  it("mengecualikan item yang tidak tersedia dari total_quantity dan total_amount, tapi tetap menampilkannya di items[]", async () => {
    mockFindUnique.mockResolvedValue(
      buildCart([
        buildCartItem({ id: "available", quantity: 2, basePrice: "100000.00" }),
        buildCartItem({
          id: "oos",
          quantity: 5,
          basePrice: "999999.00",
          stock: 0,
        }),
      ]),
    );

    const result = await getCartService("user-1");

    expect(result.items).toHaveLength(2); // tetap tampil keduanya
    expect(result.total_quantity).toBe(2); // hanya yang available
    expect(result.total_amount).toBe("200000.00"); // hanya yang available
  });

  it("image_url null kalau produk tidak punya gambar primary", async () => {
    mockFindUnique.mockResolvedValue(
      buildCart([buildCartItem({ isPrimaryImage: false })]),
    );

    const result = await getCartService("user-1");

    expect(result.items[0].image_url).toBeNull();
  });
});
