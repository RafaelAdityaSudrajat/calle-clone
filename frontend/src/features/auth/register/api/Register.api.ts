import type { RegisterResponse } from "../model/register.type";
import type { RegisterInput } from "../model/RegisterSchema";
import { axiosInstance } from "@/shared/api/axios.instance";

export const register = async (
  payload: RegisterInput,
): Promise<RegisterResponse> => {
  const { data } = await axiosInstance.post<RegisterResponse>(
    "/auth/register",
    payload,
  );
  return data;
};
