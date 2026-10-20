import { AppError } from "../../lib/errors";

type PriceChangeDetail = {
  cart_item_id: string;
  product_name: string;
  old_price: string;
  new_price: string;
};

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
export const CartErrors = {
  productNotFound: () =>
    new AppError("Product not found", 404, "PRODUCT_NOT_FOUND"),

  productNotAvailable: (reason?: string) =>
    new AppError(
      reason ?? "This product is no longer available", //Produk non-ACTIVE / soft-delete
      400,
      "PRODUCT_NOT_AVAILABLE",
    ),

  cartItemNotFound: () =>
    new AppError(
      "Item does not exist or does not belong to the user",
      404,
      "CART_ITEM_NOT_FOUND",
    ),

  invalidQuantity: (message = "Invalid quantity") =>
    new AppError(message, 400, "INVALID_QUANTITY"),

  stockInsufficient: () =>
    new AppError("Insufficient stock", 400, "STOCK_INSUFFICIENT"),

  cartEmpty: () => new AppError("Cart is empty", 400, "CART_EMPTY"),

  invalidAddress: () =>
    new AppError("Incomplete address", 400, "INVALID_ADDRESS"),

  priceChanged: (priceChanges: PriceChangeDetail[]) =>
    new AppError(
      "Price has changed; confirmation required",
      409,
      "PRICE_CHANGED",
      {
        price_changes: priceChanges,
      },
    ),
};
