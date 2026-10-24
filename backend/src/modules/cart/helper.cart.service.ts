import { Prisma } from "../../generated/prisma";

/**
 * Lock baris Cart sampai transaksi selesai.
 *
 * Semua operasi yang memodifikasi CartItem harus memperoleh lock ini
 * sebelum membaca atau mengubah item. Dengan begitu, operasi cart milik
 * user yang sama memiliki satu urutan eksekusi yang konsisten.
 *
 * Catatan:
 * - Helper wajib dipanggil di dalam transaksi Prisma.
 * - Lock hanya efektif jika operasi lain mengikuti protokol yang sama.
 * - Jika baris Cart tidak lagi ada, query berikutnya harus memvalidasi
 *   ulang keberadaan dan kepemilikan CartItem.
 */
export async function lockCartRow(
  tx: Prisma.TransactionClient,
  cartId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id
    FROM "Cart"
    WHERE id = ${cartId}
    FOR UPDATE
  `;
}

/**
 * Membaca ulang CartItem setelah Cart dikunci.
 *
 * cartId dan userId sama-sama dimasukkan ke WHERE:
 * - cartId memastikan item berada pada Cart yang sudah dikunci.
 * - userId memastikan item tetap milik user yang sedang mengaksesnya.
 *
 * Tidak membedakan item yang tidak ada dan item milik user lain.
 */
export function findOwnedCartItem(
  tx: Prisma.TransactionClient,
  userId: string,
  cartItemId: string,
  cartId: string,
) {
  return tx.cartItem.findFirst({
    where: {
      id: cartItemId,
      cartId,
      cart: { userId },
    },
    include: {
      productVariant: {
        include: { product: true },
      },
    },
  });
}
