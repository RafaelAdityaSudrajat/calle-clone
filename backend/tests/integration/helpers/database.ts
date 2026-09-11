import { prisma } from "../../../src/lib/prisma";

export const cleanAuthDatabase = async (): Promise<void> => {
  /*
   * Urutan penting karena foreign key.
   */

  await prisma.auditLog.deleteMany();

  await prisma.refreshToken.deleteMany();

  await prisma.user.deleteMany();
};

export const cleanCartDatabase = async (): Promise<void> => {
  /*
   * Urutan penting karena foreign key constraints
   */
  // Hapus cart items dulu (child dari cart & productVariant)
  await prisma.cartItem.deleteMany();

  // Hapus carts (child dari user)
  await prisma.cart.deleteMany();

  // Hapus product variants (child dari product)
  await prisma.productVariant.deleteMany();

  // Hapus product images (child dari product)
  await prisma.productImage.deleteMany();

  // Hapus products (child dari category)
  await prisma.product.deleteMany();

  // Hapus categories
  await prisma.category.deleteMany();

  // Hapus refresh tokens (child dari user)
  await prisma.refreshToken.deleteMany();

  // Hapus audit logs (child dari user)
  await prisma.auditLog.deleteMany();

  // Hapus users
  await prisma.user.deleteMany();
};
