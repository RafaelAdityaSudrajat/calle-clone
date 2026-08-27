import { axiosInstance } from "@/shared/api/axios.instance";

export const logoutApi = async (): Promise<void> => {
  await axiosInstance.post("/auth/logout");
};
