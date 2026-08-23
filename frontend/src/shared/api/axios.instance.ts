import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,

  withCredentials: true,

  headers: {
    "Content-Type": "application/json",
  },
});

/*
 * Instance khusus refresh.
 *
 * Jangan pasang response interceptor
 * refresh pada instance ini.
 */
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

interface RetryRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/*
 * Endpoint-endpoint ini tidak boleh
 * memicu automatic refresh.
 */
const SKIP_REFRESH_ENDPOINTS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/verify-email",
  "/auth/resend-verification",
];

const shouldSkipRefresh = (url?: string): boolean => {
  if (!url) {
    return false;
  }

  return SKIP_REFRESH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

/*
 * Shared Promise untuk mencegah
 * beberapa refresh berjalan bersamaan.
 */
let refreshPromise: Promise<void> | null = null;

const refreshSession = async (): Promise<void> => {
  await refreshClient.post("/auth/refresh");
};

// ─── Response Interceptor ──────────────────────────

axiosInstance.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const status = error.response?.status;

    const originalRequest = error.config as RetryRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    /*
     * Selain 401 tidak ada hubungannya
     * dengan refresh token.
     */
    if (status !== 401) {
      return Promise.reject(error);
    }

    /*
     * Endpoint tertentu tidak boleh
     * menjalankan silent refresh.
     */
    if (shouldSkipRefresh(originalRequest.url)) {
      return Promise.reject(error);
    }

    /*
     * Request ini sudah pernah di-retry.
     * Jangan ulangi lagi.
     */
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      /*
       * SINGLE-FLIGHT
       *
       * Kalau sudah ada refresh yang berjalan,
       * request ini cukup menunggu Promise
       * yang sama.
       */
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;

      /*
       * Backend sudah memberikan
       * accessToken cookie baru.
       *
       * Retry request sebelumnya.
       */
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      /*
       * Refresh token:
       *
       * - expired
       * - invalid
       * - revoked
       * - reuse detected
       *
       * Di layer API cukup reject.
       */
      return Promise.reject(refreshError);
    }
  },
);
