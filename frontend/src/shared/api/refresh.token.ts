import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const refreshTokenApi = async (): Promise<void> => {
  await refreshClient.post("/auth/refresh");
};
