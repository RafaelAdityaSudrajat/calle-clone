import { axiosInstance } from "@/shared/api/axios.instance";
import type {
  DeleteCategoryByIdResponse,
  UpdateCategoryResponse,
} from "../model/category.types";
import type { UpdateCategoryFormValues } from "../model/category.schema";
import {
  createCategoryPayloadSchema,
  createCategoryResponseSchema,
  getCategoriesResponseSchema,
  type CreateCategoryPayload,
} from "./schema";
import type { Category } from "../model/types";
import { mapCategory } from "../lib/mapper";

export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    const { data } = await axiosInstance.get<unknown>("/category");
    const parsed = getCategoriesResponseSchema.parse(data);
    return parsed.data.map(mapCategory);
  },

  create: async (payload: CreateCategoryPayload): Promise<Category> => {
    const body = createCategoryPayloadSchema.parse(payload);

    const { data } = await axiosInstance.post<unknown>("/category", body);
    const parsed = createCategoryResponseSchema.parse(data);

    return mapCategory(parsed.data);
  },

  deleteCategoryById: async (
    id: string,
  ): Promise<DeleteCategoryByIdResponse> => {
    const response = await axiosInstance.delete<DeleteCategoryByIdResponse>(
      `/category/${id}`,
    );

    return response.data;
  },

  updateCategoryById: async (
    payload: UpdateCategoryFormValues,
  ): Promise<UpdateCategoryResponse> => {
    const response = await axiosInstance.patch<UpdateCategoryResponse>(
      `/category/${payload.id}`,
      {
        name: payload.name,
      },
    );

    return response.data;
  },
};
