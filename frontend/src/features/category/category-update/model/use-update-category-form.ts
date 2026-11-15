import { toast } from "sonner";
import {
  applyServerErrorToForm,
  useCategoryForm,
  type Category,
} from "@/entities/category";
import { getErrorMessage } from "@/shared/api";
import { useUpdateCategory } from "./use-update-category";

interface Options {
  category: Category;
  onSuccess?: () => void;
}

// Render komponen pemakainya dengan key={category.id} agar form ter-reset
// saat target edit berganti.
export const useUpdateCategoryForm = ({ category, onSuccess }: Options) => {
  const form = useCategoryForm({ name: category.name });
  const { mutateAsync, isPending } = useUpdateCategory();

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutateAsync({ id: category.id, input: values });
      onSuccess?.();
    } catch (error) {
      if (!applyServerErrorToForm(error, form.setError)) {
        toast.error(getErrorMessage(error));
      }
    }
  });

  // Tombol simpan sebaiknya disabled kalau belum ada perubahan.
  return { form, onSubmit, isPending, isDirty: form.formState.isDirty };
};
