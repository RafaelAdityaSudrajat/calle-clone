import { axiosInstance } from "@/shared/api/axios.instance";

export interface resendVerifyEmailResponse {
  status: string;
  message: string;
}

export const resendVerifyEmailApi =
  async (): Promise<resendVerifyEmailResponse> => {
    const { data } = await axiosInstance.post<resendVerifyEmailResponse>(
      "/auth/resend-verification",
    );
    return data;
  };
