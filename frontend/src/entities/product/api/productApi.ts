import type {
  GetProductByIdApiResponse,
  GetProductsApiResponse,
  ProductResponse,
} from "@/entities/product/model/product.types";
import { axiosInstance } from "@/shared/api/axios.instance";


export const productsApi = {
  getAll: async (): Promise<ProductResponse[]> => {
    const response = await axiosInstance.get<GetProductsApiResponse>("/products");

    return response.data.data;
  },

  getById: async (id: string): Promise<ProductResponse> => {
    const response = await axiosInstance.get<GetProductByIdApiResponse>(
      `/products/${id}`,
    );

    return response.data.data;
  },

};
