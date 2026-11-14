import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCategoryKeys } from "./category.query-keys";
import { categoryApi } from "../api/category.api";
import type {
  CreateCategoryFormValues,
  UpdateCategoryFormValues,
} from "../model/category.schema";
import type {
  DeleteCategoryByIdResponse,
  UpdateCategoryResponse,
} from "../model/category.types";
import { toast } from "sonner";
import type { Category } from "../model/types";

export function useGetCategory() {
  return useQuery({
    queryKey: getCategoryKeys(),
    queryFn: () => categoryApi.getAll(),
    staleTime: 1000 * 60 * 2, // 2 menit — products ga perlu terlalu sering refetch
  });
}

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation<Category, Error, CreateCategoryFormValues>({
    mutationFn: categoryApi.create,
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
