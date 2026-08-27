import { axiosInstance } from "@/shared/api/axios.instance";
import type { ResetPasswordResponse } from "../model/reset.password.type";
import type { ResetPasswordPayload } from "../model/ResetPasswordSchema";

export const resetPasswordApi = async (
  payload: ResetPasswordPayload,
): Promise<ResetPasswordResponse> => {
  const { data } = await axiosInstance.post<ResetPasswordResponse>(
    "/auth/reset-password",
    payload,
  );
  return data;
};
