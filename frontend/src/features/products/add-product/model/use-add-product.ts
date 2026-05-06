// src/features/add-product/model/use-add-product.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addProductApi } from "../api/add-product.api";
import { productKeys } from "../api/product.query-keys";
import type { AddProductFormValues } from "./product.schema";
import type { AddProductApiResponse } from "@/entities/product/model/product.types";

export const useAddProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<AddProductApiResponse, Error, AddProductFormValues>({
    mutationFn: addProductApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.lists(),
      });
    },
  });
};