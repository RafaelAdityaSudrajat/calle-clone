import { z } from "zod";
import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { isApiError } from "@/shared/api";

type ErrorTarget<T extends FieldValues> = FieldPath<T> | `root.${string}`;

const validationDetailsSchema = z.object({
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
});

/** Daftar error per field dari middleware validate (kosong jika bukan error itu). */
export const getValidationErrors = (error: unknown) => {
  if (!isApiError(error) || error.code !== "VALIDATION_ERROR") return [];
  const parsed = validationDetailsSchema.safeParse(error.details);
  return parsed.success ? parsed.data.errors : [];
};

/**
 * Memetakan error backend ke form. Return true jika sudah ditangani (tidak perlu toast).
 *  1. codeMap  : error bisnis berdasarkan `code` (SKU_DUPLICATE, CONFLICT, ...)
 *  2. fieldMap : error validasi Zod backend, nama field backend → nama field form
 *     (field yang tidak dikenal masuk ke `root.server`)
 */
export const applyApiErrorToForm = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  codeMap: Readonly<Record<string, ErrorTarget<T>>> = {},
  fieldMap: Readonly<Record<string, FieldPath<T>>> = {},
): boolean => {
  if (!isApiError(error)) return false;

  const byCode = error.code ? codeMap[error.code] : undefined;
  if (byCode) {
    setError(byCode, { type: "server", message: error.message });
    return true;
  }

  const issues = getValidationErrors(error);
  if (issues.length === 0) return false;

  for (const { field, message } of issues) {
    setError(fieldMap[field] ?? "root.server", { type: "server", message });
  }
  return true;
};