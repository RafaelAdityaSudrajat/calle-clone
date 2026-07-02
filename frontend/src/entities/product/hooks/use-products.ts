import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { productsApi } from "@/entities/product/api/productApi";
import { productKeys } from "@/entities/product/model/product.query-keys";
import { toast } from "sonner";
import type {
  AddImagesResponse,
  AddProductApiResponse,
  UploadImagesInput,
} from "../model/product.types";
import type { AddProductFormValues } from "@/entities/product/model/product.schema";

export function useGetProducts() {
  return useQuery({
    queryKey: productKeys.lists(),
    queryFn: () => productsApi.getAll(),
    placeholderData: keepPreviousData, // smooth pagination, no loading flicker
    staleTime: 1000 * 60 * 2, // 2 menit — products ga perlu terlalu sering refetch
  });
}

export function useGetProductDetail(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsApi.getById(id),
    enabled: !!id, // jangan fetch kalau id belum ada
  });
}

export const useAddProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<AddProductApiResponse, Error, AddProductFormValues>({
    mutationFn: productsApi.addProductApi,
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: productKeys.lists(),
      });
      toast.success(response.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

export const useUploadMutation = () => {
  return useMutation({
    mutationFn: ({
      productId,
      formData,
    }: {
      productId: string;
      formData: FormData;
    }) => productsApi.uploadImages(productId, formData),
  });
};

// export const uploadMutation = useMutation({
//   mutationFn: ({
//     productId,
//     formData,
//   }: {
//     productId: string;
//     formData: FormData;
//   }) => uploadImages(productId, formData),
// })
