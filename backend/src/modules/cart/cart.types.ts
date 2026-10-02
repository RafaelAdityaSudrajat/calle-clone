/**
 * DTO response modul Cart.
 *
 * Aturan:
 * - Semua nominal uang berupa STRING desimal (mis. "150000.00"), bukan number.
 *   Hitung selalu pakai Prisma.Decimal di service, baru di-serialize di sini.
 * - Kunci response snake_case sesuai kontrak API.
 * - Bungkus akhir: { success, message, data } dibuat di controller/response helper.
 */

export type UnavailableReason =
  | "PRODUCT_NOT_ACTIVE" // status produk selain ACTIVE (DRAFT/INACTIVE/OUT_OF_STOCK/ARCHIVED)
  | "PRODUCT_DELETED" // produk soft-delete
  | "VARIANT_INACTIVE" // variant isActive = false
  | "OUT_OF_STOCK"; // stok variant 0

export interface CartItemDto {
  id: string;
  product_id: string;
  product_variant_id: string;
  product_name: string;
  product_slug: string;
  sku: string;
  size: string | null;
  color: string | null;
  image_url: string | null; // gambar primary produk

  quantity: number;
  available_stock: number;

  unit_price: string; // harga efektif real-time: priceOverride ?? basePrice
  price_at_add: string; // snapshot saat pertama ditambahkan
  price_changed: boolean; // unit_price != price_at_add
  subtotal: string; // unit_price * quantity

  is_available: boolean;
  unavailable_reason: UnavailableReason | null;
}

export interface CartDto {
  cart_id: string | null; // null jika cart belum pernah dibuat (200, bukan 404)
  items: CartItemDto[];
  total_quantity: number;
  total_amount: string;
}

// ---------- Checkout ----------

export interface OrderItemDto {
  id: string;
  product_variant_id: string;
  product_name: string;
  variant_sku: string;
  unit_price: string;
  quantity: number;
  subtotal: string;
}

export interface CheckoutResultDto {
  order_id: string;
  status: "PENDING_PAYMENT" | "PAID" | "CANCELLED";
  payment_status: "UNPAID" | "PAID" | "FAILED" | "REFUNDED";
  total_amount: string;
  items: OrderItemDto[];
  created_at: string; // ISO 8601
  /** true jika request ini adalah replay dari Idempotency-Key yang sama */
  idempotent_replay: boolean;
}

// ---------- Error code (dari spesifikasi) ----------

export const CART_ERROR_CODES = {
  UNAUTHORIZED: { status: 401 },
  PRODUCT_NOT_FOUND: { status: 404 },
  PRODUCT_NOT_AVAILABLE: { status: 400 },
  CART_ITEM_NOT_FOUND: { status: 404 },
  INVALID_QUANTITY: { status: 400 },
  STOCK_INSUFFICIENT: { status: 400 },
  CART_EMPTY: { status: 400 },
  INVALID_ADDRESS: { status: 400 },
  PRICE_CHANGED: { status: 409 },
  INTERNAL_ERROR: { status: 500 },
} as const;

export type CartErrorCode = keyof typeof CART_ERROR_CODES;
