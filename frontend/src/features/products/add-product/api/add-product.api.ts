// src/features/add-product/api/add-product.api.ts

import { axiosInstance } from "@/shared/api/axios.instance";
import type { AddProductFormValues } from "../model/product.schema";
import type { AddProductApiResponse } from "@/entities/product/model/product.types";

export const addProductApi = async (
  payload: AddProductFormValues,
): Promise<AddProductApiResponse> => {
  const response = await axiosInstance.post<AddProductApiResponse>(
    "/products",
    payload,
  );

  return response.data;
};
