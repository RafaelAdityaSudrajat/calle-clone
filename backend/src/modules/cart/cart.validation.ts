import z from "zod";

export const addToCartSchema = z.object({
  productVariantId: z
    .string({ message: "Product variant id is required" })
    .uuid({ message: "Invalid product variant id" }),

  quantity: z
    .number({ message: "Quantity is required and must be a number" })
    .int({ message: "Quantity must be an integer" })
    .min(1, { message: "Quantity must be greater than 0" }),
});

