import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productFormSchema, type ProductFormValues } from "./product-form.schema";

export const useProductForm = (defaultValues?: Partial<ProductFormValues>) =>
  useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { name: "", description: "", categoryId: "", ...defaultValues },
  });

  export const PRODUCT_FORM_FIELD_MAP = {
  name: "name",
  description: "description",
  category_id: "categoryId",
} as const;

// Kode error backend → field form.
export const PRODUCT_FORM_ERROR_MAP = {
  CATEGORY_NOT_FOUND: "categoryId",
  CATEGORY_REQUIRED: "categoryId",
} as const;