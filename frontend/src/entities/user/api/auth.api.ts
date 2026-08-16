import { axiosInstance } from "@/shared/api/axios.instance";
import type { LoginOutput } from "@/features/auth/login/model/LoginScema";
import type { AuthResponse } from "@/entities/user/model/userTypes";
import type { RegisterInput } from "../../../features/auth/register/model/RegisterSchema";



// ─── API ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: async (payload: RegisterInput): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post<AuthResponse>(
      "/auth/register",
      payload,
    );
    return data;
  },

  login: async (payload: LoginOutput): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post<AuthResponse>(
      "/auth/login",
      payload,
    );
    return data;
  },

  getMe: async (): Promise<AuthResponse> => {
    const { data } = await axiosInstance.get<AuthResponse>("/auth/me");
    return data;
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post("/auth/logout");
  },
};
