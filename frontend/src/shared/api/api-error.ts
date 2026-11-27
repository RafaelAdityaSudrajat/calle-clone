import { isAxiosError } from "axios";

interface ApiErrorBody {
  status?: "error";
  message?: string;
  code?: string;
  data?: unknown; // AppError.details dikirim backend di field ini
}

export interface ApiError {
  readonly name: "ApiError";
  readonly message: string;
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
}

export const createApiError = (
  message: string,
  status: number,
  code?: string,
  details?: unknown,
): ApiError => ({
  name: "ApiError",
  message,
  status,
  code,
  details,
});

export const isApiError = (error: unknown): error is ApiError =>
  typeof error === "object" &&
  error !== null &&
  (error as ApiError).name === "ApiError" &&
  typeof (error as ApiError).message === "string" &&
  typeof (error as ApiError).status === "number";

export const apiErrorFrom = (error: unknown): ApiError => {
  if (isApiError(error)) return error;

  if (isAxiosError<ApiErrorBody>(error)) {
    if (error.response) {
      const { status, data } = error.response;
      return createApiError(
        data?.message ?? "Terjadi kesalahan pada server",
        status,
        data?.code,
        data?.data,
      );
    }
    if (error.code === "ECONNABORTED") {
      return createApiError("Permintaan timeout, coba lagi", 0, "TIMEOUT");
    }
    return createApiError(
      "Tidak dapat terhubung ke server",
      0,
      "NETWORK_ERROR",
    );
  }

  return createApiError("Terjadi kesalahan tak terduga", 0, "UNKNOWN");
};

export const getErrorMessage = (error: unknown): string =>
  apiErrorFrom(error).message;
