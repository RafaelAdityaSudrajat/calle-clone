import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { variantFormSchema, type VariantFormValues } from "./variant-form.schema";

export const useVariantForm = (defaultValues?: Partial<VariantFormValues>) =>
  useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: { sku: "", size: "", color: "", stock: 0, ...defaultValues },
  });

// Kode error backend → field. Error "root" ditampilkan lewat form.formState.errors.root?.server.
export const VARIANT_FORM_ERROR_MAP = {
  SKU_DUPLICATE: "sku",
  VARIANT_DUPLICATE: "root.server",
  ATTRIBUTE_REQUIRED: "size",
  INVALID_PRICE: "price",
  INVALID_STOCK: "stock",
} as const;

export const VARIANT_FORM_FIELD_MAP = {
  sku: "sku",
  size: "size",
  color: "color",
  price: "price",
  stock: "stock",
} as const;

export const STOCK_FORM_FIELD_MAP = { stock: "stock" } as const;

export const STOCK_FORM_ERROR_MAP = { INVALID_STOCK: "stock" } as const;