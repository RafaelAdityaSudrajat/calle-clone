import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  productKeys,
  uploadProductImage,
  validateImageFile,
  type ProductImage,
} from "@/entities/product";
import { getErrorMessage, isApiError } from "@/shared/api";

export interface UploadFailure {
  fileName: string;
  message: string;
}

export interface UploadResult {
  uploaded: ProductImage[];
  failures: UploadFailure[];
}

const IDLE = { index: 0, total: 0, percent: 0 };

export const useUploadImages = (productId: string) => {
  const queryClient = useQueryClient();
  // index = file ke-berapa yang sedang diunggah; percent = progres file itu.
  const [progress, setProgress] = useState(IDLE);

  const mutation = useMutation({
    mutationFn: async (files: File[]): Promise<UploadResult> => {
      const result: UploadResult = { uploaded: [], failures: [] };

      for (const [i, file] of files.entries()) {
        const invalid = validateImageFile(file);
        if (invalid) {
          result.failures.push({ fileName: file.name, message: invalid });
          continue;
        }

        setProgress({ index: i + 1, total: files.length, percent: 0 });
        try {
          const image = await uploadProductImage(productId, file, (percent) =>
            setProgress((p) => ({ ...p, percent })),
          );
          result.uploaded.push(image);
        } catch (error) {
          result.failures.push({ fileName: file.name, message: getErrorMessage(error) });
          // Produk hilang / sesi habis: sisa file pasti gagal juga, jangan dibombardir.
          if (isApiError(error) && [401, 403, 404].includes(error.status)) break;
        }
      }
      return result;
    },
    onSuccess: async ({ uploaded, failures }) => {
      if (uploaded.length > 0) {
        await queryClient.invalidateQueries({ queryKey: productKeys.all });
        toast.success(`${uploaded.length} gambar berhasil diunggah`);
      }
      if (failures.length > 0) toast.error(`${failures.length} gambar gagal diunggah`);
    },
    onSettled: () => setProgress(IDLE),
  });

  // result.failures berisi alasan per file, untuk ditampilkan UI jika perlu.
  return { ...mutation, progress };
};