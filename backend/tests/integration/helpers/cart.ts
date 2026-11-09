import { Prisma, ProductStatus } from "../../../src/generated/prisma";
import { prisma } from "../../../src/lib/prisma";
import { createTestUserAdmin } from "./auth";

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
    status?: ProductStatus;
    deletedAt?: Date | null;
    categoryId?: string | null;
    actorId?: string; // dipakai untuk createdBy & updatedBy
  } = {},
) {
  // createdBy/updatedBy wajib (FK ke User), jadi butuh user admin
  const actorId = overrides.actorId ?? (await createTestUserAdmin()).id;
  const categoryId =
    overrides.categoryId === undefined
      ? (await seedCategory()).id
      : overrides.categoryId;

  return prisma.product.create({
    data: {
      name: `Product ${uniqueSuffix()}`,
      categoryId,
      status: overrides.status ?? "ACTIVE",
      deletedAt: overrides.deletedAt ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
}

export async function seedVariant(
  productId: string,
  overrides: {
    stock?: number;
    price?: string;
    deletedAt?: Date | null;
    size?: string;
    color?: string;
    actorId?: string;
  } = {},
) {
  // Default: pakai pembuat produknya, supaya tidak bikin user baru lagi
  const actorId =
    overrides.actorId ??
    (
      await prisma.product.findUniqueOrThrow({
        where: { id: productId },
        select: { createdBy: true },
      })
    ).createdBy;

  return prisma.productVariant.create({
    data: {
      productId,
      sku: `SKU-${uniqueSuffix()}`,
      size: overrides.size ?? "M",
      color: overrides.color ?? "Black",
      price: new Prisma.Decimal(overrides.price ?? "100000.00"),
      stock: overrides.stock ?? 10,
      deletedAt: overrides.deletedAt ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
}

export async function seedCart(userId: string) {
  return prisma.cart.create({ data: { userId } });
}

// Dibuat nested karena `deletedAt` ada di Product dan di ProductVariant,
// kalau flat nilainya akan masuk ke keduanya.
export async function seedProductWithVariant(
  overrides: {
    product?: Parameters<typeof seedProduct>[0];
    variant?: Parameters<typeof seedVariant>[1];
  } = {},
) {
  const product = await seedProduct(overrides.product);
  const variant = await seedVariant(product.id, overrides.variant);
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
