import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { productKeys } from "../model/product.keys";
import type {
  ProductDetailOptions,
  ProductListParams,
  VariantListParams,
} from "../model/product.types";
import { getLowStockVariants, getProductById, getProducts, getVariants } from "./product.api";

export const productQueries = {
  list: (params: ProductListParams = {}) =>
    queryOptions({
      queryKey: productKeys.list(params),
      queryFn: ({ signal }) => getProducts(params, signal),
      // Halaman lama tetap tampil saat pindah page/filter (tanpa kedip skeleton).
      placeholderData: keepPreviousData,
    }),
  detail: (id: string, options: ProductDetailOptions = {}) =>
    queryOptions({
      queryKey: productKeys.detail(id, options),
      queryFn: ({ signal }) => getProductById(id, options, signal),
      enabled: Boolean(id),
    }),
  variants: (productId: string, params: VariantListParams = {}) =>
    queryOptions({
      queryKey: productKeys.variants(productId, params),
      queryFn: ({ signal }) => getVariants(productId, params, signal),
      enabled: Boolean(productId),
    }),
  lowStock: () =>
    queryOptions({
      queryKey: productKeys.lowStock(),
      queryFn: ({ signal }) => getLowStockVariants(signal),
    }),
};

export const useProducts = (params: ProductListParams = {}) =>
  useQuery(productQueries.list(params));
export const useProduct = (id: string, options: ProductDetailOptions = {}) =>
  useQuery(productQueries.detail(id, options));
export const useProductVariants = (productId: string, params: VariantListParams = {}) =>
  useQuery(productQueries.variants(productId, params));
export const useLowStockVariants = () => useQuery(productQueries.lowStock());