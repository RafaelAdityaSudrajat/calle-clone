import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Jangan retry error 4xx (validasi, 404, 403): hasilnya pasti sama.
      retry: (failureCount, error) =>
        !(isApiError(error) && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});
