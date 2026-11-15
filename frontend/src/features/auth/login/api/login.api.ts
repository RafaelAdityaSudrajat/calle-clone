import type { LoginInput } from "../model/LoginScema";
// import { axiosInstance } from "@/shared/api/axios.instance";
import type { LoginResponse } from "../../auth.response.interface";
import { http } from "@/shared/api";

const BASE = "/auth";

// export const loginApi = async (payload: LoginInput): Promise<LoginResponse> => {
//   const { data } = await axiosInstance.post<LoginResponse>(
//     "/auth/login",
//     payload,
//   );
//   return data;
// };

export const loginApi = async (payload: LoginInput): Promise<LoginResponse> => {
  const res = await http.post(`${BASE}/login`, payload, {
    skipAuthRefresh: true,
  });
  return res.data;
};
