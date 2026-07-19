import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCartKeys } from "./cart.query-keys";
import { cartApi } from "../api/cartApi";
import type { UpdateCartResponse } from "./cart.types";
import { toast } from "sonner";
import type { updateCartInputValues } from "@/features/cart/addToCart/model/cart.schema";

export function useGetCart() {
  return useQuery({
    queryKey: getCartKeys(),
    queryFn: () => cartApi.getAll(),
    staleTime: 1000 * 60 * 2, // 2 menit — products ga perlu terlalu sering refetch
  });
}

export const useAddCart = () => {
  const queryClient = useQueryClient();

  return useMutation<UpdateCartResponse, Error, updateCartInputValues>({
    mutationFn: cartApi.addCartApi,
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: getCartKeys(),
      });
      toast.success(response.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
