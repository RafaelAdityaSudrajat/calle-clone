import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
});

export const createCategoryConfig = {
  body: createCategorySchema,
};

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

const categoryIdParamsSchema = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export const categoryIdParamsConfig = {
  params: categoryIdParamsSchema,
};

export type CategoryIdParamsInput = z.infer<typeof categoryIdParamsSchema>;

export const updateCategoryConfig = {
  body: createCategorySchema,
};

export type UpdateCategoryInput = z.infer<typeof createCategorySchema>;
