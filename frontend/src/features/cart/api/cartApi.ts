import { axiosInstance } from "@/shared/api/axios.instance";
import type { CartResponse } from "../model/cart.types";

export const cartApi = {
  getAll: async (): Promise<CartResponse> => {
    const { data } = await axiosInstance.get<CartResponse>("/cart");
    return data;
  },
};
