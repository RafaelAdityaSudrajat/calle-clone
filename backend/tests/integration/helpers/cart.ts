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
    size?: string;
    color?: string;
  } = {},
) {
  const suffix = uniqueSuffix();

  return prisma.productVariant.create({
    data: {
      productId,
      sku: `SKU-${suffix}`,
      size: overrides.size ?? "M",
      color: overrides.color ?? "Black",
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

export async function seedProductWithVariant(
  overrides: Parameters<typeof seedProduct>[0] &
    Parameters<typeof seedVariant>[1] = {},
) {
  const product = await seedProduct(overrides);
  const variant = await seedVariant(product.id, overrides);
  return { product, variant };
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

export async function seedOrderWithItem(
  userId: string,
  productVariantId: string,
  overrides: { quantity?: number; unitPrice?: string } = {},
) {
  const quantity = overrides.quantity ?? 2;
  const unitPrice = new Prisma.Decimal(overrides.unitPrice ?? "100000.00");

  return prisma.order.create({
    data: {
      userId,
      totalAmount: unitPrice.mul(quantity),
      shippingRecipientName: "Test User",
      shippingPhone: "081234567890",
      shippingAddressLine: "Jl. Test No. 1",
      shippingCity: "Bandung",
      shippingPostalCode: "40111",
      idempotencyKey: `idem-${uniqueSuffix()}`,
      items: {
        create: [
          {
            productVariantId,
            productName: "Test Product",
            variantSku: `SKU-SNAPSHOT-${uniqueSuffix()}`,
            unitPrice,
            quantity,
            subtotal: unitPrice.mul(quantity),
          },
        ],
      },
    },
  });
}
