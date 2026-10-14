import { prisma } from "../../lib/prisma";
import { toMoneyString } from "../cart/money";
import { ListOrdersQuery } from "./order.schema";
import { OrderListDto, OrderSummaryDto } from "./order.types";

/**
 * GET /orders.
 *
 * Beda karakter dengan cart.service yang penuh lock & validasi stok ->
 * endpoint ini MURNI READ. Tidak ada transaksi tulis, tidak ada race
 * condition, tidak ada side effect. Jadi fungsi ini sengaja TIDAK
 * dibungkus prisma.$transaction.
 *
 * Yang WAJIB ada:
 *  - Filter `userId` di WHERE (BR-02, anti-IDOR). Ini satu-satunya
 *    pertahanan supaya user tidak bisa "menyapu" order user lain.
 *  - Order by createdAt DESC -> user lihat order terbaru dulu.
 *  - Pagination offset (skip/take), bukan cursor-based: volume per user
 *    kecil & tidak ada realtime stream -> offset lebih simpel, dan
 *    memungkinkan "lompat ke halaman N".
 *
 * Yang SENGAJA TIDAK ada:
 *  - include: { items: true } -> lihat komentar OrderSummaryDto.
 *  - Default filter status -> user harus lihat SEMUA order kecuali dia
 *    secara eksplisit filter.
 */
export async function getOrdersService(
  userId: string,
  query: ListOrdersQuery,
): Promise<OrderListDto> {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  // userId SELALU ada di where, apapun query-nya. Ini invariant yang
  // bikin endpoint ini anti-IDOR by construction.
  const where = {
    userId,
    ...(status ? { status } : {}),
  };

  // Promise.all, BUKAN $transaction: dua query READ tidak butuh atomic.
  // Worst case: count & rows berasal dari milidetik yang berbeda -> total
  // di pagination bisa meleset 1 saat ada INSERT bersamaan. Trade-off
  // yang diterima demi menghindari overhead transaksi di endpoint read-
  // only yang paling sering dipanggil di halaman ini.
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      // Terbaru di atas. Tie-break pakai id supaya urutan STABIL kalau
      // createdAt sama (dua order di ms yang sama) -> mencegah order
      // "loncat" antar halaman saat pagination.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        paidAt: true,
        createdAt: true,
        // _count = aggregated COUNT dari relasi, dihitung di DB.
        // Bukan ambil semua row items lalu hitung di JS.
        _count: { select: { items: true } },
      },
    }),
  ]);

  const orders: OrderSummaryDto[] = rows.map((o) => ({
    id: o.id,
    status: o.status,
    payment_status: o.paymentStatus,
    total_amount: toMoneyString(o.totalAmount),
    total_items: o._count.items,
    created_at: o.createdAt.toISOString(),
    paid_at: o.paidAt ? o.paidAt.toISOString() : null,
  }));

  // total_pages minimal 1 -> frontend tidak perlu handle "halaman /0"
  // saat user baru punya 0 order.
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
    },
  };
}
