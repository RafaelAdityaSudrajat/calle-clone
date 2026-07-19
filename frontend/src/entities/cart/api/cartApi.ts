import { axiosInstance } from "@/shared/api/axios.instance";
import type { UpdateCartResponse, CartResponse } from "../model/cart.types";
import type { updateCartInputValues } from "@/features/cart/addToCart/model/cart.schema";

export const cartApi = {
  getAll: async (): Promise<CartResponse> => {
    const { data } = await axiosInstance.get<CartResponse>("/cart");
    return data;
  },
  addCartApi: async (
    payload: updateCartInputValues,
  ): Promise<UpdateCartResponse> => {
    const response = await axiosInstance.post<UpdateCartResponse>(
      "/cart",
      payload,
    );

    return response.data;
  },
};
