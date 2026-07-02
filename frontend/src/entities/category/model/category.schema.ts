import { z } from "zod";


// create category schema
export const createCategorySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
});

// update category schema
export const updateCategorySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  id: z.string()
});

export type CreateCategoryFormValues = z.infer<typeof createCategorySchema>;
export type UpdateCategoryFormValues = z.infer<typeof updateCategorySchema>;