import { axiosInstance } from "@/shared/api/axios.instance";
import type { CategoriesResponse } from "../model/category.types";

export const categoryApi = {
  getAll: async (): Promise<CategoriesResponse> => {
    const { data } = await axiosInstance.get<CategoriesResponse>("/category");
    return data;
  },
};
