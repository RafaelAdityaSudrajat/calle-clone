import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { archiveProduct, productKeys } from "@/entities/product";
import { getErrorMessage } from "@/shared/api";

export const useArchiveProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Produk diarsipkan");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
