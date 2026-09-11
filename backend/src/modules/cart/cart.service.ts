import { ProductStatus } from "../../generated/prisma";
import { ConflictError, NotFoundError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

interface AddToCartServiceArgs {
  userId: string;
  productVariantId: string;
  quantity: number;
}

interface getCartByIdArgs {
  userId: string | undefined;
}

export const getCartByUserId = async ({ userId }: getCartByIdArgs) => {
  console.log(userId);

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      cartItems: {
        include: {
          productVariant: {
            include: {
              product: {
                include: {
                  images: true, // Ikut menarik semua gambar produk tersebut
                },
              },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    throw new NotFoundError("cart not found");
  }

  return {
    message: cart && "Get Cart Successfully",
    data: cart,
  };
};

export const addToCartService = async ({
  userId,
  productVariantId,
  quantity,
}: AddToCartServiceArgs) => {
  return prisma.$transaction(async (tx) => {
    // Cek product variant
    const productVariant = await tx.productVariant.findUnique({
      where: {
        id: productVariantId,
      },
      include: {
        product: true,
      },
    });

    // Variant tidak ditemukan
    if (!productVariant) {
      throw new NotFoundError("Product variant tidak di temukan");
    }
    // Variant harus active
    if (!productVariant.isActive) {
      throw new ConflictError("Product variant tidak tersedia");
    }

    // Product harus ACTIVE
    if (productVariant.product.status !== ProductStatus.ACTIVE) {
      throw new ConflictError("Product tidak tersedia");
    }

    // Product tidak boleh soft delete
    if (productVariant.product.deletedAt) {
      throw new ConflictError("Product sudah di hapus");
    }

    //  Stock harus cukup
    if (quantity > productVariant.stock) {
      throw new ConflictError("melebihi stock");
    }

    //  Cari Cart User
    const cart = await tx.cart.upsert({
      where: { userId },
      update: {}, // Jika ada, tidak melakukan update apa-apa
      create: { userId }, // Jika tidak ada, buat baru
    });

    const cartItem = await tx.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: productVariant.id,
        },
      },
    });

    const totalQuantity = cartItem?.quantity ?? 0;

    if (totalQuantity + quantity > productVariant.stock) {
      throw new ConflictError("stock tidak cukup");
    }

    const updatedCartItem = await tx.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: productVariant.id,
        },
      },
      update: {
        // Menggunakan "increment" mencegah lost update dari concurrent request
        quantity: { increment: quantity },
      },
      create: {
        cartId: cart.id,
        productVariantId: productVariant.id,
        quantity: quantity,
      },
    });

    return {
      message: cartItem
        ? "Cart updated successfully"
        : "Product telah ditambahkan ke cart successfully",
      data: updatedCartItem,
    };
  });
};
