import { useQuery } from "@tanstack/react-query";
import { getCartKeys } from "./cart.query-keys";
import { cartApi } from "../api/cartApi";



export function useGetCart() {
  return useQuery({
    queryKey: getCartKeys(),
    queryFn: () => cartApi.getAll(),
    staleTime: 1000 * 60 * 2, // 2 menit — products ga perlu terlalu sering refetch
  });
}