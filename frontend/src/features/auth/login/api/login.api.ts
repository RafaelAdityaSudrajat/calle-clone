import type { AuthResponse } from "@/entities/user/model/userTypes";
import type { LoginOutput } from "../model/LoginScema";
import { axiosInstance } from "@/shared/api/axios.instance";

  export const login = async (payload: LoginOutput): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post<AuthResponse>(
      "/auth/login",
      payload,
    );
    return data;
  }