import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { productsApi } from '@/entities/product/api/productApi'
import { productKeys } from '@/entities/product/model/product.query-keys'




export function useProducts() {
  return useQuery({
    queryKey: productKeys.lists(),
    queryFn: () => productsApi.getAll(),
    placeholderData: keepPreviousData, // smooth pagination, no loading flicker
    staleTime: 1000 * 60 * 2, // 2 menit — products ga perlu terlalu sering refetch
  })
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsApi.getById(id),
    enabled: !!id, // jangan fetch kalau id belum ada
  })
}
