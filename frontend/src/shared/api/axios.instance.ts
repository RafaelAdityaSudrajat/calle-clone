import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Response Interceptor ─────────────────────────────────────────────────────

const AUTH_ENDPOINTS = ["/auth/me", "/auth/login", "/auth/register", "/cart"];

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl: string = error.config?.url ?? "";

    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) =>
      requestUrl.includes(endpoint)
    );

    if (status === 401 && !isAuthEndpoint) {
      window.location.href = "/account";
    }

    return Promise.reject(error);
  }
);