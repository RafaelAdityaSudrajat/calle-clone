import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteProductImage, productKeys } from "@/entities/product";
import { getErrorMessage } from "@/shared/api";

export const useDeleteImage = (productId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) => deleteProductImage(productId, imageId),
    onSuccess: async () => {
      // Gambar utama otomatis berpindah (BR-20), dan status produk bisa berubah.
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Gambar dihapus");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};