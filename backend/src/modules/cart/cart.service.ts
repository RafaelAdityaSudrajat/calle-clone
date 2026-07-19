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
  console.log(userId);
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

    // Product harus ACTIVE
    if (productVariant.product.status !== "ACTIVE") {
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
    let cart = await tx.cart.findUnique({
      where: {
        userId,
      },
    });

    // * Kalau belum ada Cart buat otomatis

    if (!cart) {
      cart = await tx.cart.create({
        data: {
          userId,
        },
      });
    }

    const cartItem = await tx.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: productVariant.id,
        },
      },
    });

    const totalQuantity = (cartItem?.quantity ?? 0) + quantity;

    if (totalQuantity > productVariant.stock) {
      throw new ConflictError("stock tidak cukup");
    }

    let updatedCartItem;

    if (cartItem) {
      updatedCartItem = await tx.cartItem.update({
        where: {
          id: cartItem.id,
        },
        data: {
          quantity: totalQuantity,
        },
      });
    } else {
      updatedCartItem = await tx.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: productVariant.id,
          quantity,
        },
      });
    }

    return {
      message: cartItem
        ? "Cart updated successfully"
        : "Product telah di tambakhan ke cart successfully",
      data: updatedCartItem,
    };
  });
};
