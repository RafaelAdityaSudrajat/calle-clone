import { AppError } from "../../lib/errors";

/**
 * Error bisnis khusus domain Cart.
 *
 * Kenapa factory function, bukan class per code:
 * - Semua tetap instanceof AppError, jadi error handler global tidak perlu
 *   tahu domain apapun, cukup baca err.statusCode & err.code.
 * - Menambah error code baru = menambah satu fungsi, bukan satu file class baru.
 * - Pesan & status code business rule terpusat di satu tempat, gampang di-audit
 *   terhadap dokumen spesifikasi.
 */

export const OrderErrors = {
  notFound: () => new AppError("Order not found", 404, "ORDER_NOT_FOUND"),
};
