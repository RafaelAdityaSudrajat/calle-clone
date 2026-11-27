import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  VARIANT_FORM_ERROR_MAP,
  VARIANT_FORM_FIELD_MAP,
  createVariant,
  productKeys,
  toVariantPayload,
  useVariantForm,
  type VariantFormValues,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { applyApiErrorToForm } from "@/shared/lib/form-errors";

interface Options {
  productId: string;
  onSuccess?: () => void;
}

export const useCreateVariantForm = ({ productId, onSuccess }: Options) => {
  const queryClient = useQueryClient();
  const form = useVariantForm();

  const mutation = useMutation({
    mutationFn: (values: VariantFormValues) =>
      createVariant(productId, toVariantPayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Varian berhasil ditambahkan");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
      form.reset();
      onSuccess?.();
    } catch (error) {
      if (!applyApiErrorToForm(error, form.setError, VARIANT_FORM_ERROR_MAP, VARIANT_FORM_FIELD_MAP)) {
        toast.error(getErrorMessage(error));
      }
    }
  });

  return { form, onSubmit, isPending: mutation.isPending };
};