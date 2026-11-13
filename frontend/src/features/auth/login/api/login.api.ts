import type { LoginInput } from "../model/LoginScema";
import { axiosInstance } from "@/shared/api/axios.instance";
import type { LoginResponse } from "../../auth.response.interface";

export const loginApi = async (payload: LoginInput): Promise<LoginResponse> => {
  const { data } = await axiosInstance.post<LoginResponse>(
    "/auth/login",
    payload,
  );
  return data;
};
