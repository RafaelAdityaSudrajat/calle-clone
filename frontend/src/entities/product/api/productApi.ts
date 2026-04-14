import type { ProductsResponse, ProductItem } from "@/entities/product/model/typesProducts";
import fetcher from "@/shared/api/fetcher";

const BASE_URL = "https://dummyjson.com";


export const productsApi = {
  getAll: () => {
    return fetcher<ProductsResponse>(`${BASE_URL}/products`);
  },

  getById: (id: number) =>
    fetcher<ProductItem>(`${BASE_URL}/products/${id}`),

};
