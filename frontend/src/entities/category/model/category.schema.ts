import { z } from "zod";

// Bentuk data dari backend
export const categorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryListSchema = z.array(categorySchema);

// Input form. Create dan update sama-sama hanya `name` (selaras backend).
export const categoryFormSchema = z.object({
  name: z.string().trim().min(3, "Nama kategori minimal 3 karakter"),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
