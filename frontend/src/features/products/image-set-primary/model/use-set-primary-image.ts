import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productKeys, setPrimaryImage } from "@/entities/product";
import { getErrorMessage } from "@/shared/api";

export const useSetPrimaryImage = (productId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) => setPrimaryImage(productId, imageId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Gambar utama diperbarui");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};