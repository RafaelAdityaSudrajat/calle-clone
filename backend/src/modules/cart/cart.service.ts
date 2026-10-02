import { Prisma } from "../../generated/prisma";
import {
  getEffectivePrice,
  subtotal,
  sumMoney,
  hasPriceChanged,
  toMoneyString,
} from "./money";

import { prisma } from "../../lib/prisma";
import { CartDto, CartItemDto, UnavailableReason } from "./cart.types";

interface AddToCartServiceArgs {
  userId: string;
  productVariantId: string;
  quantity: number;
}

interface getCartByIdArgs {
  userId: string | undefined;
}

function findCartByUserId(userId: string) {
  return prisma.cart.findUnique({
    where: { userId }, // BR: satu user satu cart, filter userId cegah IDOR
    include: {
      cartItems: {
        orderBy: { createdAt: "asc" },
        include: {
          productVariant: {
            include: {
              product: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

type CartWithItems = NonNullable<Awaited<ReturnType<typeof findCartByUserId>>>;
type CartItemWithRelations = CartWithItems["cartItems"][number];

function getUnavailableReason(
  item: CartItemWithRelations,
): UnavailableReason | null {
  const { product } = item.productVariant;
  const variant = item.productVariant;

  if (product.isDeleted) return "PRODUCT_DELETED";
  if (product.status !== "ACTIVE") return "PRODUCT_NOT_ACTIVE";
  if (!variant.isActive) return "VARIANT_INACTIVE";
  if (variant.stock === 0) return "OUT_OF_STOCK";

  return null;
}

function toCartItemDto(item: CartItemWithRelations): CartItemDto {
  const { productVariant: variant } = item;
  const { product } = variant;

  const unavailableReason = getUnavailableReason(item);
  const unitPrice = getEffectivePrice(product, variant);
  const itemSubtotal = subtotal(unitPrice, item.quantity);
  const primaryImage = product.images[0]?.url ?? null;

  return {
    id: item.id,
    product_id: product.id,
    product_variant_id: variant.id,
    product_name: product.name,
    product_slug: product.slug,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    image_url: primaryImage,

    quantity: item.quantity,
    available_stock: variant.stock,

    unit_price: toMoneyString(unitPrice),
    price_at_add: toMoneyString(item.priceAtAdd),
    price_changed: hasPriceChanged(unitPrice, item.priceAtAdd),
    subtotal: toMoneyString(itemSubtotal),

    is_available: unavailableReason === null,
    unavailable_reason: unavailableReason,
  };
}

export async function getCartService(userId: string): Promise<CartDto> {
  const cart = await findCartByUserId(userId);

  if (!cart) {
    return {
      cart_id: null,
      items: [],
      total_quantity: 0,
      total_amount: toMoneyString(new Prisma.Decimal(0)),
    };
  }

  const items = cart.cartItems.map(toCartItemDto);

  const availableItems = items.filter((i) => i.is_available);
  const totalQuantity = availableItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = sumMoney(
    availableItems.map((i) => new Prisma.Decimal(i.subtotal)),
  );

  return {
    cart_id: cart.id,
    items,
    total_quantity: totalQuantity,
    total_amount: toMoneyString(totalAmount),
  };
}

// export const getCartByUserId = async ({ userId }: getCartByIdArgs) => {
//   console.log(userId);

//   const cart = await prisma.cart.findUnique({
//     where: { userId },
//     include: {
//       cartItems: {
//         include: {
//           productVariant: {
//             include: {
//               product: {
//                 include: {
//                   images: true, // Ikut menarik semua gambar produk tersebut
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//   });

//   if (!cart) {
//     throw new NotFoundError("cart not found");
//   }

//   return {
//     message: cart && "Get Cart Successfully",
//     data: cart,
//   };
// };

// export const addToCartService = async ({
//   userId,
//   productVariantId,
//   quantity,
// }: AddToCartServiceArgs) => {
//   return prisma.$transaction(async (tx) => {
//     // Cek product variant
//     const productVariant = await tx.productVariant.findUnique({
//       where: {
//         id: productVariantId,
//       },
//       include: {
//         product: true,
//       },
//     });

//     // Variant tidak ditemukan
//     if (!productVariant) {
//       throw new NotFoundError("Product variant tidak di temukan");
//     }
//     // Variant harus active
//     if (!productVariant.isActive) {
//       throw new ConflictError("Product variant tidak tersedia");
//     }

//     // Product harus ACTIVE
//     if (productVariant.product.status !== ProductStatus.ACTIVE) {
//       throw new ConflictError("Product tidak tersedia");
//     }

//     // Product tidak boleh soft delete
//     if (productVariant.product.deletedAt) {
//       throw new ConflictError("Product sudah di hapus");
//     }

//     //  Stock harus cukup
//     if (quantity > productVariant.stock) {
//       throw new ConflictError("melebihi stock");
//     }

//     //  Cari Cart User
//     const cart = await tx.cart.upsert({
//       where: { userId },
//       update: {}, // Jika ada, tidak melakukan update apa-apa
//       create: { userId }, // Jika tidak ada, buat baru
//     });

//     const cartItem = await tx.cartItem.findUnique({
//       where: {
//         cartId_productVariantId: {
//           cartId: cart.id,
//           productVariantId: productVariant.id,
//         },
//       },
//     });

//     const totalQuantity = cartItem?.quantity ?? 0;

//     if (totalQuantity + quantity > productVariant.stock) {
//       throw new ConflictError("stock tidak cukup");
//     }

//     const updatedCartItem = await tx.cartItem.upsert({
//       where: {
//         cartId_productVariantId: {
//           cartId: cart.id,
//           productVariantId: productVariant.id,
//         },
//       },
//       update: {
//         // Menggunakan "increment" mencegah lost update dari concurrent request
//         quantity: { increment: quantity },
//       },
//       create: {
//         cartId: cart.id,
//         productVariantId: productVariant.id,
//         quantity: quantity,
//       },
//     });

//     return {
//       message: cartItem
//         ? "Cart updated successfully"
//         : "Product telah ditambahkan ke cart successfully",
//       data: updatedCartItem,
//     };
//   });
// };
