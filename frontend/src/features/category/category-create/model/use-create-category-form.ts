import { toast } from "sonner";
import { applyServerErrorToForm, useCategoryForm } from "@/entities/category";
import { getErrorMessage } from "@/shared/api";
import { useCreateCategory } from "./use-create-category";

interface Options {
  onSuccess?: () => void;
}

export const useCreateCategoryForm = ({ onSuccess }: Options = {}) => {
  const form = useCategoryForm();
  const { mutateAsync, isPending } = useCreateCategory();

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutateAsync(values);
      form.reset();
      onSuccess?.();
    } catch (error) {
      if (!applyServerErrorToForm(error, form.setError)) {
        toast.error(getErrorMessage(error));
      }
    }
  });

  return { form, onSubmit, isPending };
};
