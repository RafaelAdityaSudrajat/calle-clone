import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().nonnegative("Stock must be non-negative"),
  categoryId: z.string().uuid("Invalid category ID"),
  variants: z
    .array(
      z.object({
        size: z.string().min(1, "Size is required"),
        color: z.string().min(1, "Color is required"),
        stock: z.number().int().nonnegative("Stock must be non-negative"),
        price: z.number().positive("Price must be positive").optional(),
      }),
    )
    .optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  stock: z.number().int().nonnegative('Stock must be non-negative').optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  isActive: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const getProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type GetProductsQuery = z.infer<typeof getProductsQuerySchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>;
