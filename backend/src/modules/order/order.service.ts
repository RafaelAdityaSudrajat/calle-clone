import { Prisma } from "../../generated/prisma";
import { prisma } from "../../lib/prisma";
import { toMoneyString } from "../cart/money";
import { OrderErrors } from "./order.errors";
import { ListOrdersQuery } from "./order.schema";
import { OrderDetailDto, OrderListDto, OrderSummaryDto } from "./order.types";

/**
 * Query shape untuk GET /orders/:id — type helper biar DTO mapper dapat
 * autocomplete lengkap tanpa duplikasi type inline.
 */
type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { orderBy: { createdAt: "asc" } } };
}>;

function toOrderDetailDto(order: OrderWithItems): OrderDetailDto {
  return {
    id: order.id,
    status: order.status,
    payment_status: order.paymentStatus,
    total_amount: toMoneyString(order.totalAmount),

    // Snapshot alamat — murni COPY dari kolom order, bukan hasil JOIN.
    // Jadi kalau user ubah alamat defaultnya besok, order lama tetap
    // tampil dengan alamat saat checkout.
    shipping_address: {
      recipient_name: order.shippingRecipientName,
      phone: order.shippingPhone,
      address_line: order.shippingAddressLine,
      city: order.shippingCity,
      postal_code: order.shippingPostalCode,
    },

    items: order.items.map((i) => ({
      id: i.id,
      product_variant_id: i.productVariantId,
      product_name: i.productName, // snapshot, bukan JOIN
      variant_sku: i.variantSku, // snapshot, bukan JOIN
      unit_price: toMoneyString(i.unitPrice), // beku, bukan harga sekarang
      quantity: i.quantity,
      subtotal: toMoneyString(i.subtotal),
    })),

    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    paid_at: order.paidAt ? order.paidAt.toISOString() : null,
  };
}

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

/**
 * GET /orders/:id.
 *
 * Prinsip anti-IDOR: `userId` SELALU ada di WHERE, dipasangkan dengan
 * `id` order. Ini pola `findFirst({ where: { id, userId } })` — BUKAN
 * `findUnique({ where: { id } })` yang lalu dicek ownership di JS.
 *
 * Kenapa beda? `findUnique` akan gagal P2025 kalau row tidak ada, dan
 * kita harus catch → ini noise. `findFirst` dengan userId sekaligus
 * menggabungkan "ada" + "milik user" jadi satu query atomik yang tidak
 * bisa race.
 *
 * Kenapa TIDAK query items dengan userId juga?
 *  - OrderItem tidak punya userId. Ownership diturunkan dari Order.
 *  - Karena Order sudah terfilter userId, include items aman — semua
 *    item PASTI milik order yang sudah terverifikasi milik user ini.
 *
 * Sengaja TIDAK dibungkus $transaction (read-only, single query),
 * konsisten dengan getOrdersService & getCartService.
 */
export async function getOrderByIdService(
  userId: string,
  orderId: string,
): Promise<OrderDetailDto> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        // Urutan stabil, sama seperti saat checkout & list.
        // Tanpa orderBy, Postgres tidak menjamin urutan.
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) {
    // BUKAN `return null`. User MEMINTA satu resource spesifik —
    // "tidak ada" di sini artinya permintaan TIDAK terpenuhi, dan itu
    // beda dari "user belum punya order" (list kosong = sukses).
    //
    // Anti-IDOR: pesan & kode SAMA untuk "tidak ada" vs "milik user
    // lain" → attacker tidak bisa probing.
    throw OrderErrors.notFound();
  }

  return toOrderDetailDto(order);
}
