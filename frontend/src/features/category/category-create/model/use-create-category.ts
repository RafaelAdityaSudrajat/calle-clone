import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoryKeys, createCategory } from "@/entities/category";

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      toast.success("categori berhasil dibuat");
    },
  });
};
