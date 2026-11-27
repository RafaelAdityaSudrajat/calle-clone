import { z } from "zod";
import type { CreateVariantPayload } from "./product.types";

const MAX_PRICE = 9_999_999_999.99; // kolom Decimal(12,2)
const MAX_STOCK = 2_147_483_647; // Int 32-bit Postgres

export const stockField = z
  .number({ error: "Stok wajib diisi" })
  .int("Stok harus bilangan bulat")
  .min(0, "Stok tidak boleh negatif")
  .max(MAX_STOCK, "Stok terlalu besar");

// Input angka di UI harus didaftarkan dengan register("price", { valueAsNumber: true }).
export const variantFormSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU wajib diisi").max(100, "SKU maksimal 100 karakter"),
    size: z.string().trim().max(20, "Ukuran maksimal 20 karakter"),
    color: z.string().trim().max(50, "Warna maksimal 50 karakter"),
    price: z
      .number({ error: "Harga wajib diisi" })
      .positive("Harga harus lebih dari 0")
      .max(MAX_PRICE, "Harga terlalu besar"),
    stock: stockField,
  })
  .refine((v) => v.size !== "" || v.color !== "", {
    message: "Isi minimal salah satu: ukuran atau warna",
    path: ["size"],
  });
export type VariantFormValues = z.infer<typeof variantFormSchema>;

export const stockFormSchema = z.object({ stock: stockField });
export type StockFormValues = z.infer<typeof stockFormSchema>;

// Create dan update memakai payload yang sama; "" dikirim sebagai null.
export const toVariantPayload = (values: VariantFormValues): CreateVariantPayload => ({
  sku: values.sku,
  size: values.size || null,
  color: values.color || null,
  price: values.price,
  stock: values.stock,
});