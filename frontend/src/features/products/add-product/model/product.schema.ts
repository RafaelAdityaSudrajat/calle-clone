// src/entities/product/model/product.schema.ts
import { z } from "zod";

const variantSchema = z.object({
  size: z.string().min(1, "Size is required"),
  color: z.string().min(1, "Color is required"),
  stock: z.number().min(0, "Stock must be non-negative"),
});

export const addProductSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().nonnegative("Stock must be non-negative"),
  categoryId: z.string().uuid("Invalid category ID"),
  variants: z.array(variantSchema),
});

export type AddProductFormValues = z.infer<typeof addProductSchema>;
