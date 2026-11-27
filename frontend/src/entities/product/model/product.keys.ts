import type {
  ProductDetailOptions,
  ProductListParams,
  VariantListParams,
} from "./product.types";

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (params: ProductListParams) => [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: string, options: ProductDetailOptions) =>
    [...productKeys.details(), id, options] as const,
  variants: (productId: string, params: VariantListParams) =>
    [...productKeys.all, "variants", productId, params] as const,
  lowStock: () => [...productKeys.all, "low-stock"] as const,
};