import { axiosInstance } from "@/shared/api/axios.instance";
import type {
  CategoryResponse,
  CreateCategoryResponse,
  DeleteCategoryByIdResponse,
  UpdateCategoryResponse,
} from "../model/category.types";
import type {
  CreateCategoryFormValues,
  UpdateCategoryFormValues,
} from "../model/category.schema";

export const categoryApi = {
  getAll: async (): Promise<CategoryResponse> => {
    const { data } = await axiosInstance.get<CategoryResponse>("/category");
    return data;
  },

  createCategory: async (
    payload: CreateCategoryFormValues,
  ): Promise<CreateCategoryResponse> => {
    const { data } = await axiosInstance.post<CreateCategoryResponse>(
      "/category",
      payload,
    );
    return data;
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
