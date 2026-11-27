import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteVariant, productKeys } from "@/entities/product";
import { getErrorMessage } from "@/shared/api";

export const useDeleteVariant = (productId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variantId: string) => deleteVariant(productId, variantId),
    onSuccess: async () => {
      // Seluruh cache produk: status produk bisa berubah otomatis (BR-27).
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Varian dihapus");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};