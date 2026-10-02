import { Prisma } from "../../../src/generated/prisma";
import { prisma } from "../../../src/lib/prisma";

/**
 * Semua helper di sini sengaja terima `overrides` dan isi default sendiri,
 * supaya tiap test cuma perlu nulis field yang dia pedulikan, sisanya
 * otomatis valid (lolos NOT NULL / UNIQUE constraint).
 *
 * ID pakai random suffix supaya antar test tidak tabrakan UNIQUE
 * (email, slug, sku) walau resetDatabase() lupa dipanggil.
 */

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export async function seedCategory() {
  const suffix = uniqueSuffix();
  return prisma.category.create({
    data: { name: `Category ${suffix}`, slug: `category-${suffix}` },
  });
}

export async function seedProduct(
  overrides: {
    status?: "DRAFT" | "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK" | "ARCHIVED";
    isDeleted?: boolean;
    basePrice?: string;
    categoryId?: string;
  } = {},
) {
  const categoryId = overrides.categoryId ?? (await seedCategory()).id;
  const suffix = uniqueSuffix();

  return prisma.product.create({
    data: {
      categoryId,
      name: `Product ${suffix}`,
      slug: `product-${suffix}`,
      basePrice: new Prisma.Decimal(overrides.basePrice ?? "100000.00"),
      status: overrides.status ?? "ACTIVE",
      isDeleted: overrides.isDeleted ?? false,
    },
  });
}

export async function seedVariant(
  productId: string,
  overrides: {
    stock?: number;
    isActive?: boolean;
    priceOverride?: string | null;
  } = {},
) {
  const suffix = uniqueSuffix();

  return prisma.productVariant.create({
    data: {
      productId,
      sku: `SKU-${suffix}`,
      size: "M",
      color: "Black",
      stock: overrides.stock ?? 10,
      isActive: overrides.isActive ?? true,
      priceOverride: overrides.priceOverride
        ? new Prisma.Decimal(overrides.priceOverride)
        : null,
    },
  });
}

export async function seedCart(userId: string) {
  return prisma.cart.create({ data: { userId } });
}

export async function seedCartItem(
  cartId: string,
  productVariantId: string,
  overrides: { quantity?: number; priceAtAdd?: string } = {},
) {
  return prisma.cartItem.create({
    data: {
      cartId,
      productVariantId,
      quantity: overrides.quantity ?? 1,
      priceAtAdd: new Prisma.Decimal(overrides.priceAtAdd ?? "100000.00"),
    },
  });
}
