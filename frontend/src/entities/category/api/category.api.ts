import { z } from "zod";
import { http, apiResponseSchema } from "@/shared/api";
import {
  categorySchema,
  categoryListSchema,
  type Category,
  type CategoryFormValues,
} from "../model/category.schema";

const BASE = "/categories";

// Respons divalidasi saat runtime, jadi perubahan kontrak backend langsung ketahuan.
export const getCategories = async (
  signal?: AbortSignal,
): Promise<Category[]> => {
  const res = await http.get(BASE, { signal });
  return apiResponseSchema(categoryListSchema).parse(res.data).data;
};

export const getCategoryById = async (
  id: string,
  signal?: AbortSignal,
): Promise<Category> => {
  const res = await http.get(`${BASE}/${id}`, { signal });
  return apiResponseSchema(categorySchema).parse(res.data).data;
};

export const createCategory = async (
  input: CategoryFormValues,
): Promise<Category> => {
  const res = await http.post(BASE, input);
  return apiResponseSchema(categorySchema).parse(res.data).data;
};

export const updateCategory = async (
  id: string,
  input: CategoryFormValues,
): Promise<Category> => {
  const res = await http.patch(`${BASE}/${id}`, input);
  return apiResponseSchema(categorySchema).parse(res.data).data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  const res = await http.delete(`${BASE}/${id}`);
  apiResponseSchema(z.null()).parse(res.data);
};
