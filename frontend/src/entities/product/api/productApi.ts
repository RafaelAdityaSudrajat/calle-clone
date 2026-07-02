import type {
  AddImagesResponse,
  AddProductApiResponse,
  GetProductByIdApiResponse,
  GetProductsApiResponse,
  ProductResponse,
} from "@/entities/product/model/product.types";
import type { AddProductFormValues } from "@/entities/product/model/product.schema";
import { axiosInstance } from "@/shared/api/axios.instance";

export const productsApi = {
  getAll: async (): Promise<ProductResponse[]> => {
    const response =
      await axiosInstance.get<GetProductsApiResponse>("/products");

    return response.data.data;
  },

  getById: async (id: string): Promise<ProductResponse> => {
    const response = await axiosInstance.get<GetProductByIdApiResponse>(
      `/products/${id}`,
    );

    return response.data.data;
  },

  addProductApi: async (
    payload: AddProductFormValues,
  ): Promise<AddProductApiResponse> => {
    const response = await axiosInstance.post<AddProductApiResponse>(
      "/products",
      payload,
    );
    
    return response.data;
  },

  uploadImages : async (productId: string, formData: FormData) => {
  const response = await axiosInstance.post<AddImagesResponse>(
    `/products/${productId}/images`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data
}
};


