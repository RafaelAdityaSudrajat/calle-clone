import { axiosInstance } from "@/shared/api/axios.instance";
import type { RegisterOutput } from "@/features/auth/RegisterSchema";
import type { LoginOutput } from "@/features/auth/LoginScema";
import type { User } from "@/shared/types/authTypes";

// ─── Types ────────────────────────────────────────────────────────────────────


export interface AuthResponse {  
  message: string;
  user: User;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: async (payload: RegisterOutput): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post<AuthResponse>("/auth/register", payload);
    return data;
  },

  login: async (payload: LoginOutput): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post<AuthResponse>("/auth/login", payload);
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