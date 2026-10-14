import type { OrderStatus, PaymentStatus } from "../../generated/prisma";

/**
 * Ringkasan satu order untuk keperluan LIST (GET /orders).
 *
 * SENGAJA tidak menyertakan `items` di sini. Alasan:
 *  1. List bisa berisi puluhan order. Kalau include seluruh items,
 *     payload-nya membengkak untuk data yang belum tentu dilihat user.
 *     Detail items baru dibutuhkan saat user membuka SATU order -> itu
 *     tugas endpoint GET /orders/:id nanti.
 *  2. Menghindari N+1 pattern di sisi Prisma (mengambil items untuk
 *     semua order di halaman).
 *
 * `total_items` = jumlah BARIS OrderItem (jenis produk), bukan jumlah
 * qty. Ini konvensi e-commerce "3 jenis produk" di halaman daftar
 * pesanan. Kalau nanti butuh total qty, tambah field BARU (mis.
 * `total_quantity`) -- jangan ubah arti field ini, biar tidak breaking.
 */
export type OrderSummaryDto = {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: string; // Decimal -> string, konsisten dengan cart & checkout
  total_items: number;
  created_at: string; // ISO 8601
  paid_at: string | null; // ISO 8601 atau null
};

export type OrderListPaginationDto = {
  page: number;
  limit: number;
  total: number; // total order (setelah filter status), bukan total item
  total_pages: number; // Math.ceil(total / limit), minimum 1
};

export type OrderListDto = {
  orders: OrderSummaryDto[];
  pagination: OrderListPaginationDto;
};
