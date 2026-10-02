import { z } from "zod";

/**
 * Validasi request modul Cart (Zod v4).
 *
 * Kontrak API (snake_case) mengikuti spesifikasi. Setiap body di-transform
 * ke camelCase supaya service & controller bekerja dengan konvensi TypeScript.
 *
 * Catatan: pesan error API berbahasa Inggris (frontend yang menerjemahkan).
 * Mapping ZodError -> error code (INVALID_QUANTITY, INVALID_ADDRESS) dilakukan
 * di middleware validate / error handler berdasarkan path field yang gagal.
 */

// ---------- Reusable ----------

const quantity = (min: number) =>
  z
    .int({ error: "Quantity must be an integer" })
    .min(min, { error: `Quantity must be at least ${min}` });

const uuid = (field: string) =>
  z.uuid({ error: `${field} must be a valid UUID` });

// ---------- POST /cart ----------

export const addToCartBodySchema = z
  .strictObject({
    product_variant_id: uuid("product_variant_id"),
    quantity: quantity(1),
  })
  .transform((v) => ({
    productVariantId: v.product_variant_id,
    quantity: v.quantity,
  }));

export const addToCartSchema = { body: addToCartBodySchema };

// ---------- PATCH /cart/:cartItemId ----------
// quantity = 0 diterjemahkan sebagai delete (BR), jadi min 0.

export const cartItemParamsSchema = z.strictObject({
  cartItemId: uuid("cartItemId"),
});

export const updateCartItemBodySchema = z.strictObject({
  quantity: quantity(0),
});

export const updateCartItemSchema = {
  params: cartItemParamsSchema,
  body: updateCartItemBodySchema,
};

// ---------- DELETE /cart/:cartItemId ----------

export const removeCartItemSchema = { params: cartItemParamsSchema };

// ---------- POST /cart/checkout ----------

const trimmed = (field: string, max: number) =>
  z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, { error: `${field} is required` })
    .max(max, { error: `${field} must be at most ${max} characters` });

export const shippingAddressSchema = z
  .strictObject({
    recipient_name: trimmed("recipient_name", 100),
    // Asumsi: nomor telepon Indonesia/internasional, 8-15 digit, boleh diawali +
    phone: z
      .string({ error: "phone is required" })
      .trim()
      .regex(/^\+?\d{8,15}$/, { error: "phone must be 8-15 digits" }),
    address_line: trimmed("address_line", 255),
    city: trimmed("city", 100),
    // Asumsi: kode pos Indonesia = 5 digit
    postal_code: z
      .string({ error: "postal_code is required" })
      .trim()
      .regex(/^\d{5}$/, { error: "postal_code must be 5 digits" }),
  })
  .transform((a) => ({
    recipientName: a.recipient_name,
    phone: a.phone,
    addressLine: a.address_line,
    city: a.city,
    postalCode: a.postal_code,
  }));

export const checkoutBodySchema = z
  .strictObject({
    shipping_address: shippingAddressSchema,
    confirm_price_change: z.boolean().default(false),
  })
  .transform((v) => ({
    shippingAddress: v.shipping_address,
    confirmPriceChange: v.confirm_price_change,
  }));

// Express meng-lowercase nama header, jadi key-nya "idempotency-key".
export const checkoutHeadersSchema = z
  .looseObject({
    "idempotency-key": z.uuid({
      error: "Idempotency-Key header must be a valid UUID",
    }),
  })
  .transform((h) => ({ idempotencyKey: h["idempotency-key"] }));

export const checkoutSchema = {
  body: checkoutBodySchema,
  headers: checkoutHeadersSchema,
};

// ---------- Tipe hasil parse (input service) ----------

export type AddToCartInput = z.output<typeof addToCartBodySchema>;
export type UpdateCartItemInput = z.output<typeof updateCartItemBodySchema>;
export type CartItemParams = z.output<typeof cartItemParamsSchema>;
export type ShippingAddressInput = z.output<typeof shippingAddressSchema>;
export type CheckoutInput = z.output<typeof checkoutBodySchema> &
  z.output<typeof checkoutHeadersSchema>;
