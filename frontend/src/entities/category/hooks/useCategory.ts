import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCategoryKeys } from "./category.query-keys";
import { categoryApi } from "../api/categoryApi";
import type { CreateCategoryFormValues, UpdateCategoryFormValues } from "../model/category.schema";
import type { CreateCategoryResponse, DeleteCategoryByIdResponse, UpdateCategoryResponse } from "../model/category.types";
import { toast } from "sonner";

export function useGetCategory() {
  return useQuery({
    queryKey: getCategoryKeys(),
    queryFn: () => categoryApi.getAll(),
    staleTime: 1000 * 60 * 2, // 2 menit — products ga perlu terlalu sering refetch
  });
}

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateCategoryResponse, Error, CreateCategoryFormValues>({
    mutationFn: categoryApi.createCategory,
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: getCategoryKeys(),
      });
      toast.success(response.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

export const useDeleteCategoryById = () => {
  const queryClient = useQueryClient();

  return useMutation<DeleteCategoryByIdResponse, Error, string>({
    mutationFn: categoryApi.deleteCategoryById,
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: getCategoryKeys(),
      });
      toast.success(response.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

export const useUpdateCategoryById = () => {
  const queryClient = useQueryClient();

  return useMutation<UpdateCategoryResponse, Error, UpdateCategoryFormValues>({
    mutationFn: categoryApi.updateCategoryById,
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: getCategoryKeys(),
      });
      toast.success(response.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};