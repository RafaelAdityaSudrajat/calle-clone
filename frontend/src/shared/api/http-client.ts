import axios, { isAxiosError, type AxiosError } from "axios";
import { apiErrorFrom, isApiError } from "./api-error";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Lewati auto-refresh saat 401 (dipakai login & refresh itu sendiri). */
    skipAuthRefresh?: boolean;
    /** Internal: penanda request sudah pernah di-retry. */
    _retry?: boolean;
  }
}

const REFRESH_URL = "/auth/refresh";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  timeout: 15_000,
});

// Callback dari layer app (hapus state sesi, redirect ke login, dll.)
let sessionExpiredHandler: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  sessionExpiredHandler = handler;
};

// Single-flight: banyak request 401 bersamaan hanya memicu SATU refresh.
let refreshPromise: Promise<void> | null = null;

const refreshSession = (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = http
      .post(REFRESH_URL, {}, { skipAuthRefresh: true })
      .then(() => undefined)
      .catch((error: unknown) => {
        // Logout hanya jika refresh benar-benar ditolak, bukan karena jaringan putus.
        if (
          isApiError(error) &&
          (error.status === 401 || error.status === 403)
        ) {
          sessionExpiredHandler?.();
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const shouldRefresh = (error: AxiosError): boolean =>
  error.response?.status === 401 &&
  !!error.config &&
  !error.config._retry &&
  !error.config.skipAuthRefresh;

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (isAxiosError(error) && shouldRefresh(error)) {
      const original = error.config!;
      original._retry = true;

      try {
        await refreshSession();
        return await http(original); // ulangi request asli dengan cookie baru
      } catch {
        return Promise.reject(apiErrorFrom(error));
      }
    }
    return Promise.reject(apiErrorFrom(error));
  },
);
