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
import { AddToCartInput, UpdateCartItemInput } from "./cart.schema";
import { CartErrors } from "./cart.errors";

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

/**
 * POST /cart.
 *
 * - Auto-create cart kalau user belum punya (BR).
 * - Validasi produk: Product.status harus ACTIVE, tidak isDeleted, variant
 *   harus isActive. Kalau tidak lolos -> PRODUCT_NOT_AVAILABLE (400), BUKAN
 *   PRODUCT_NOT_FOUND. PRODUCT_NOT_FOUND (404) khusus kalau variant_id-nya
 *   memang tidak ada row-nya sama sekali.
 * - Add bersifat ATOMIC INCREMENT (bukan absolute): add 2x quantity 1 pada
 *   variant yang sama -> quantity jadi 2, bukan ketimpa jadi 1.
 * - priceAtAdd HANYA diisi saat row CartItem baru dibuat, tidak pernah
 *   diupdate pada add berikutnya -> tetap snapshot dari penambahan pertama.
 * - Validasi stok memakai quantity AKUMULASI (quantity yang sudah ada di
 *   cart + quantity baru), bukan cuma quantity dari request ini saja.
 *
 * Konkurensi: stok TIDAK dikurangi di sini (baru dikurangi saat checkout,
 * sesuai keputusan kita), jadi race yang perlu dicegah bukan race di kolom
 * stock, tapi race antar dua request add bersamaan pada CartItem yang sama
 * (lost update pada perhitungan quantity akumulasi). Makanya baris Cart
 * dikunci lewat SELECT ... FOR UPDATE sebelum baca & tulis CartItem, supaya
 * dua request add yang datang bersamaan untuk user yang sama diproses
 * berurutan (serial), bukan paralel.
 */
export async function addToCartService(
  userId: string,
  input: AddToCartInput,
): Promise<CartDto> {
  const { productVariantId, quantity } = input;

  await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: productVariantId },
      include: { product: true },
    });

    if (!variant) {
      throw CartErrors.productNotFound();
    }

    const { product } = variant;
    if (product.isDeleted || product.status !== "ACTIVE" || !variant.isActive) {
      throw CartErrors.productNotAvailable();
    }

    // Auto-create cart. Aman dari race antar user berbeda karena Cart.userId
    // UNIQUE; kalau dua request pertama user yang sama datang bersamaan,
    // salah satunya akan gagal constraint lalu Prisma retry via upsert.
    const cart = await tx.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    // Kunci baris Cart user ini sampai transaksi selesai, supaya request
    // add lain untuk cart yang sama menunggu, bukan jalan paralel.
    await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id} FOR UPDATE`;

    const existingItem = await tx.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId,
        },
      },
    });

    const accumulatedQuantity = (existingItem?.quantity ?? 0) + quantity;
    if (accumulatedQuantity > variant.stock) {
      throw CartErrors.stockInsufficient();
    }

    const unitPrice = getEffectivePrice(product, variant);

    await tx.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId,
        },
      },
      create: {
        cartId: cart.id,
        productVariantId,
        quantity,
        priceAtAdd: unitPrice, // snapshot HANYA saat row baru dibuat
      },
      update: {
        quantity: { increment: quantity }, // atomic increment, bukan overwrite
        // priceAtAdd SENGAJA tidak disentuh di sini
      },
    });
  });

  // Dibaca ulang di luar transaksi: lebih simpel & reuse logic getCart
  // sepenuhnya (availability, price_changed, total), dan datanya sudah
  // pasti ter-commit karena transaksi di atas sudah selesai.
  return getCartService(userId);
}

/**
 * Ambil satu CartItem milik user tertentu, sekaligus validasi kepemilikan.
 *
 * SENGAJA tidak membedakan "item tidak ada sama sekali" vs "item ada tapi
 * punya user lain" -> dua-duanya balas CART_ITEM_NOT_FOUND (404) yang sama.
 * Ini anti-IDOR: kalau dibedakan (mis. 403 utk "milik user lain"), attacker
 * bisa menebak-nebak cartItemId user lain cuma dari beda status code.
 */
function findOwnedCartItem(userId: string, cartItemId: string) {
  return prisma.cartItem.findFirst({
    where: { id: cartItemId, cart: { userId } },
    include: {
      productVariant: { include: { product: true } },
    },
  });
}

/**
 * PATCH /cart/:cartItemId
 *
 * - quantity = 0 -> diterjemahkan sebagai delete (BR). Delete item yang
 *   produknya sudah non-ACTIVE tetap BOLEH (supaya user bisa bersih-bersih
 *   cart dari barang mati), beda dengan update quantity > 0 yang DITOLAK
 *   untuk produk non-ACTIVE.
 * - Update bersifat ABSOLUTE (menimpa quantity apa adanya), beda dengan
 *   add yang atomic increment. Jadi stok divalidasi terhadap quantity baru
 *   itu sendiri, bukan akumulasi.
 * - priceAtAdd TIDAK pernah disentuh di sini, cuma berubah lewat add
 *   pertama kali. Update quantity bukan "nambah barang", jadi snapshot
 *   harga awal tetap harus utuh untuk deteksi price_changed.
 */
export async function updateCartItemService(
  userId: string,
  cartItemId: string,
  input: UpdateCartItemInput,
): Promise<CartDto> {
  const { quantity } = input;

  if (quantity === 0) {
    return removeCartItemService(userId, cartItemId);
  }

  const item = await findOwnedCartItem(userId, cartItemId);
  if (!item) {
    throw CartErrors.cartItemNotFound();
  }
  const { productVariant: variant } = item;
  const { product } = variant;

  // BR: update (quantity > 0) pada produk non-ACTIVE ditolak. Beda dengan
  // delete (quantity = 0) di atas, yang boleh jalan tanpa cek ini.
  if (product.isDeleted || product.status !== "ACTIVE" || !variant.isActive) {
    throw CartErrors.productNotAvailable();
  }

  if (quantity > variant.stock) {
    throw CartErrors.stockInsufficient();
  }

  await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity }, // absolute set, priceAtAdd sengaja tidak ikut diubah
  });

  return getCartService(userId);
}

export async function removeCartItemService(
  userId: string,
  cartItemId: string,
): Promise<CartDto> {
  const { count } = await prisma.cartItem.deleteMany({
    where: { id: cartItemId, cart: { userId } },
  });

  if (count === 0) {
    throw CartErrors.cartItemNotFound();
  }

  return getCartService(userId);
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
