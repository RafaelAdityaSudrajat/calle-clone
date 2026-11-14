import type { UseFormSetError } from "react-hook-form";
import { isApiError } from "@/shared/api";
import type { CategoryFormValues } from "./category.schema";

/**
 * Memetakan error backend ke field form.
 * Return true jika error sudah ditangani di field (tidak perlu toast).
 */
export const applyServerErrorToForm = (
  error: unknown,
  setError: UseFormSetError<CategoryFormValues>,
): boolean => {
  if (isApiError(error) && error.status === 409) {
    setError("name", { type: "server", message: error.message });
    return true;
  }
  return false;
};
