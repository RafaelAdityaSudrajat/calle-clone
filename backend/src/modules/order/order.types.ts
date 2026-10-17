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

/**
 * Satu baris item order.
 *
 * SEMUA field adalah SNAPSHOT yang dibekukan saat checkout (DD-06, BR-14).
 * product_name & variant_sku di sini BUKAN hasil JOIN ke Product/Variant —
 * sengaja dibaca langsung dari tabel OrderItem, supaya histori order tetap
 * utuh walau produk di-rename, variant dihapus, atau harga berubah.
 *
 * product_variant_id tetap disertakan untuk keperluan navigasi
 * ("beli lagi", "lihat produk") — tapi TIDAK dijamin masih exist.
 * Frontend harus handle kalau variant sudah hilang.
 */
export type OrderItemDto = {
  id: string;
  product_variant_id: string;
  product_name: string;
  variant_sku: string;
  unit_price: string;
  quantity: number;
  subtotal: string;
};

/**
 * Snapshot alamat pengiriman saat order dibuat (DD-05).
 *
 * Kenapa nested object, bukan 5 field flat di root?
 *  - Mengelompokkan data yang secara domain memang satu kesatuan (alamat).
 *  - Frontend bisa render <AddressCard data={order.shipping_address} />
 *    tanpa destructure panjang.
 *  - Kalau nanti ada perluasan (province, district, notes), tinggal
 *    tambah field di dalam object yang sama — tidak breaking.
 */
export type ShippingAddressDto = {
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  postal_code: string;
};

/**
 * Detail satu order (GET /orders/:id).
 *
 * Beda dari OrderSummaryDto:
 *  - Ada `items` (detail lengkap per baris)
 *  - Ada `shipping_address` (snapshot alamat)
 *  - Ada `updated_at` (untuk audit perubahan status)
 *  - TIDAK ada `total_items` — sudah implisit dari panjang `items`.
 *    Menyertakan keduanya membuka celah "mismatch" yang bikin bingung.
 */
export type OrderDetailDto = {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: string;
  shipping_address: ShippingAddressDto;
  items: OrderItemDto[];
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};
