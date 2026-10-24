import { Prisma } from "../../generated/prisma";
import {
  getEffectivePrice,
  subtotal,
  sumMoney,
  hasPriceChanged,
  toMoneyString,
} from "./money";

import { prisma } from "../../lib/prisma";
import {
  CartDto,
  CartItemDto,
  UnavailableReason,
  CheckoutResultDto,
} from "./cart.types";
import {
  AddToCartInput,
  UpdateCartItemInput,
  CheckoutInput,
} from "./cart.schema";
import { CartErrors } from "./cart.errors";
import { findOwnedCartItem, lockCartRow } from "./helper.cart.service";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

function toCheckoutResultDto(
  order: OrderWithItems,
  replay: boolean,
): CheckoutResultDto {
  return {
    order_id: order.id,
    status: order.status,
    payment_status: order.paymentStatus,
    total_amount: toMoneyString(order.totalAmount),
    items: order.items.map((i) => ({
      id: i.id,
      product_variant_id: i.productVariantId,
      product_name: i.productName,
      variant_sku: i.variantSku,
      unit_price: toMoneyString(i.unitPrice),
      quantity: i.quantity,
      subtotal: toMoneyString(i.subtotal),
    })),
    created_at: order.createdAt.toISOString(),
    idempotent_replay: replay,
  };
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
  if (variant.stock < item.quantity) {
    return "INSUFFICIENT_STOCK";
  }

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
    await lockCartRow(tx, cart.id);

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
 * PATCH /cart/:cartItemId
 *
 * - Quantity 0 diterjemahkan menjadi delete.
 * - Untuk quantity > 0, Cart harus dikunci sebelum item dibaca ulang.
 * - Validasi produk, ownership, dan stok dilakukan di dalam transaksi.
 * - Quantity di-update secara absolut, bukan increment.
 * - priceAtAdd tetap tidak berubah.
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

  await prisma.$transaction(async (tx) => {
    // 1. Cari CartItem secara terbatas pada user ini.
    //    Query awal hanya untuk mengetahui Cart mana yang harus dikunci.
    const candidate = await tx.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: { userId },
      },
      select: {
        cartId: true,
      },
    });

    if (!candidate) {
      throw CartErrors.cartItemNotFound();
    }

    // 2. Semua mutasi pada Cart yang sama harus mengikuti lock yang sama.
    await lockCartRow(tx, candidate.cartId);

    // 3. Baca ulang setelah lock diperoleh.
    //    Item mungkin sudah dihapus oleh checkout sebelum lock ini didapat.
    const item = await findOwnedCartItem(
      tx,
      userId,
      cartItemId,
      candidate.cartId,
    );

    if (!item) {
      throw CartErrors.cartItemNotFound();
    }

    const { productVariant: variant } = item;
    const { product } = variant;

    // 4. Produk yang tidak tersedia tidak boleh di-update.
    //    Delete tetap diperbolehkan melalui removeCartItemService.
    if (product.isDeleted || product.status !== "ACTIVE" || !variant.isActive) {
      throw CartErrors.productNotAvailable();
    }

    if (quantity > variant.stock) {
      throw CartErrors.stockInsufficient();
    }

    // 5. Update dengan filter ownership tetap.
    //    updateMany memungkinkan kita memeriksa apakah row benar-benar
    //    ter-update, tanpa hanya mengandalkan ID yang diberikan client.
    const { count } = await tx.cartItem.updateMany({
      where: {
        id: cartItemId,
        cartId: candidate.cartId,
        cart: { userId },
      },
      data: {
        quantity,
      },
    });

    if (count === 0) {
      throw CartErrors.cartItemNotFound();
    }
  });

  return getCartService(userId);
}

/**
 * DELETE /cart/:cartItemId
 *
 * - Cari item milik user untuk mengetahui Cart yang harus dikunci.
 * - Lock Cart sebelum melakukan penghapusan.
 * - Filter DELETE tetap memeriksa id, cartId, dan userId.
 * - Item yang sudah tidak ada menghasilkan CART_ITEM_NOT_FOUND.
 * - Produk non-ACTIVE tetap boleh dihapus.
 */
export async function removeCartItemService(
  userId: string,
  cartItemId: string,
): Promise<CartDto> {
  await prisma.$transaction(async (tx) => {
    // 1. Cari CartItem milik user. Hanya mengambil cartId untuk lock.
    const candidate = await tx.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: { userId },
      },
      select: {
        cartId: true,
      },
    });

    if (!candidate) {
      throw CartErrors.cartItemNotFound();
    }

    // 2. Lock Cart sebelum mengubah CartItem.
    await lockCartRow(tx, candidate.cartId);

    // 3. Hapus hanya jika item masih ada dan ownership masih cocok.
    const { count } = await tx.cartItem.deleteMany({
      where: {
        id: cartItemId,
        cartId: candidate.cartId,
        cart: { userId },
      },
    });

    if (count === 0) {
      throw CartErrors.cartItemNotFound();
    }
  });

  return getCartService(userId);
}

export async function checkoutService(
  userId: string,
  input: CheckoutInput,
): Promise<CheckoutResultDto> {
  const { shippingAddress, confirmPriceChange, idempotencyKey } = input;

  const { order, replay } = await prisma.$transaction(async (tx) => {
    // 1. Kunci cart dulu, supaya dua checkout user yang sama diproses berurutan.
    const cart = await tx.cart.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (cart) {
      await lockCartRow(tx, cart.id);
    }

    // 2. Replay idempotency, SETELAH lock. Request kedua dengan key yang sama
    //    menunggu lock, lalu melihat order dari request pertama. Kalau dicek
    //    sebelum lock, dia melihat cart kosong dan gagal CART_EMPTY.
    const existing = await tx.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (existing) {
      return { order: existing, replay: true };
    }

    if (!cart) throw CartErrors.cartEmpty();

    const cartItems = await tx.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: "asc" },
      include: { productVariant: { include: { product: true } } },
    });
    if (cartItems.length === 0) throw CartErrors.cartEmpty();

    // 3. Validasi availability + stok untuk SEMUA item sebelum menulis apa pun.
    //    Satu item bermasalah menolak seluruh checkout.
    for (const { quantity, productVariant: variant } of cartItems) {
      const { product } = variant;
      if (
        product.isDeleted ||
        product.status !== "ACTIVE" ||
        !variant.isActive
      ) {
        throw CartErrors.productNotAvailable();
      }
      if (quantity > variant.stock) {
        throw CartErrors.stockInsufficient();
      }
    }

    // 4. Harga terkini, lalu cek perubahan harga.
    const lines = cartItems.map((item) => {
      const { productVariant: variant } = item;
      const unitPrice = getEffectivePrice(variant.product, variant);

      return {
        cartItemId: item.id,
        productName: variant.product.name,
        variant,
        quantity: item.quantity,
        priceAtAdd: item.priceAtAdd,
        unitPrice,
        lineSubtotal: subtotal(unitPrice, item.quantity),
        priceChanged: hasPriceChanged(unitPrice, item.priceAtAdd),
      };
    });

    // Buat detail hanya untuk item yang harganya benar-benar berubah.
    // old_price berasal dari snapshot CartItem.priceAtAdd;
    // new_price berasal dari harga efektif produk saat checkout.
    const priceChanges = lines
      .filter((line) => line.priceChanged)
      .map((line) => ({
        cart_item_id: line.cartItemId,
        product_name: line.productName,
        old_price: toMoneyString(line.priceAtAdd),
        new_price: toMoneyString(line.unitPrice),
      }));

    if (!confirmPriceChange && lines.some((l) => l.priceChanged)) {
      throw CartErrors.priceChanged(priceChanges);
    }

    const totalAmount = sumMoney(lines.map((line) => line.lineSubtotal));

    // 5. Kurangi stok. Update kondisional (stock >= qty) adalah penjaga oversell
    //    yang sebenarnya. Diurutkan per variant id supaya dua checkout dengan
    //    variant yang beririsan mengunci baris dalam urutan sama (tanpa deadlock).
    const byVariantId = [...lines].sort((a, b) =>
      a.variant.id.localeCompare(b.variant.id),
    );
    for (const line of byVariantId) {
      const { count } = await tx.productVariant.updateMany({
        where: { id: line.variant.id, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (count === 0) {
        throw CartErrors.stockInsufficient();
      }
    }

    // 6. Buat order + snapshot item (harga dibekukan di sini).
    const created = await tx.order.create({
      data: {
        userId,
        totalAmount,
        shippingRecipientName: shippingAddress.recipientName,
        shippingPhone: shippingAddress.phone,
        shippingAddressLine: shippingAddress.addressLine,
        shippingCity: shippingAddress.city,
        shippingPostalCode: shippingAddress.postalCode,
        idempotencyKey,
        items: {
          create: lines.map((l) => ({
            productVariantId: l.variant.id,
            productName: l.variant.product.name,
            variantSku: l.variant.sku,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            subtotal: l.lineSubtotal,
          })),
        },
      },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    // 7. Kosongkan cart. Cart-nya sendiri tetap ada.
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return { order: created, replay: false };
  });

  return toCheckoutResultDto(order, replay);
}
