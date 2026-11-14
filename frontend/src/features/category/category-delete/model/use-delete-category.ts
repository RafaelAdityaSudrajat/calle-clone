import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoryKeys, deleteCategory } from "@/entities/category";
import { getErrorMessage } from "@/shared/api";

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: categoryKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      toast.success("Kategori berhasil dihapus");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
};
