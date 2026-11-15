import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  categoryKeys,
  updateCategory,
  type CategoryFormValues,
} from "@/entities/category";

interface UpdateVariables {
  id: string;
  input: CategoryFormValues;
}

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateVariables) => updateCategory(id, input),
    onSuccess: async (category) => {
      queryClient.setQueryData(categoryKeys.detail(category.id), category);
      await queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      toast.success("Kategori berhasil diperbarui");
    },
  });
};
