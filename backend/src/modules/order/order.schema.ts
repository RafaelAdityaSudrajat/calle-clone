import { z } from "zod";

/**
 * Validasi query untuk GET /orders.
 *
 * Semua field OPSIONAL: request tanpa query = page 1, limit 10, tanpa
 * filter status. Ini yang diharapkan frontend saat pertama buka halaman
 * "Pesanan Saya".
 *
 * Catatan Zod v4: `z.coerce` dipakai karena query string dari Express
 * SELALU string ("1", "10"), bukan number. Tanpa coerce, schema akan
 * menolak request dengan pesan yang membingungkan.
 */

// Nilai-nilai ini HARUS sinkron dengan enum OrderStatus di schema.prisma.
// Kalau enum diubah, update juga di sini. (Alternatif: z.enum(OrderStatus)
// langsung dari Prisma, tapi bergantung dukungan Zod terhadap enum object
// -- hardcode lebih predictable lintas versi Zod.)
const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "CANCELLED"] as const;

const page = z.coerce
  .number({ error: "page must be a number" })
  .int({ error: "page must be an integer" })
  .min(1, { error: "page must be at least 1" })
  .default(1);

const limit = z.coerce
  .number({ error: "limit must be a number" })
  .int({ error: "limit must be an integer" })
  .min(1, { error: "limit must be at least 1" })
  // 50 = batas atas wajar. Cukup untuk scroll panjang, tapi tidak
  // membuka celah DoS lewat ?limit=999999.
  .max(50, { error: "limit must be at most 50" })
  .default(10);

/**
 * Filter status. Opsional karena default-nya "tampilkan semua". Frontend
 * bisa pakai ini untuk tab "Belum Bayar" / "Selesai" di halaman pesanan.
 *
 * SENGAJA strictObject: query di luar { page, limit, status } ditolak.
 * Trade-off: kalau frontend nambah tracking param (utm_source dsb.),
 * harus ganti ke looseObject. Untuk saat ini strict lebih aman karena
 * memaksa kontrak query tetap bersih.
 */
export const listOrdersQuerySchema = z.strictObject({
  page,
  limit,
  status: z.enum(ORDER_STATUSES).optional(),
});

/**
 * Params untuk GET /orders/:orderId.
 * Validasi UUID di layer schema (bukan di service) supaya:
 *  1. Invalid format → 400 (INVALID_PARAM), beda dari "tidak ditemukan"
 *     → 404. Ini penting: user salah ketik UUID dapat pesan jelas, bukan
 *     "order tidak ditemukan" yang membingungkan.
 *  2. Service tidak perlu try/catch Prisma error P2023 (invalid UUID).
 */
export const orderParamsSchema = z.strictObject({
  orderId: z.uuid({ error: "orderId must be a valid UUID" }),
});

export const listOrdersSchema = { query: listOrdersQuerySchema };
export const getOrderByIdSchema = { params: orderParamsSchema };

export type ListOrdersQuery = z.output<typeof listOrdersQuerySchema>;
export type OrderParams = z.output<typeof orderParamsSchema>;
