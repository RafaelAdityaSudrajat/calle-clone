import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  VARIANT_FORM_ERROR_MAP,
  VARIANT_FORM_FIELD_MAP,
  productKeys,
  toVariantPayload,
  updateVariant,
  useVariantForm,
  type Variant,
  type VariantFormValues,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { applyApiErrorToForm } from "@/shared/lib/form-errors";

interface Options {
  productId: string;
  variant: Variant;
  onSuccess?: () => void;
}

// Pakai key={variant.id} di komponen pemakainya agar form ter-reset saat varian berganti.
export const useUpdateVariantForm = ({ productId, variant, onSuccess }: Options) => {
  const queryClient = useQueryClient();
  const form = useVariantForm({
    sku: variant.sku,
    size: variant.size ?? "",
    color: variant.color ?? "",
    price: variant.price,
    stock: variant.stock,
  });

  const mutation = useMutation({
    mutationFn: (values: VariantFormValues) =>
      updateVariant(productId, variant.id, toVariantPayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Varian berhasil diperbarui");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
      form.reset(values);
      onSuccess?.();
    } catch (error) {
      if (!applyApiErrorToForm(error, form.setError, VARIANT_FORM_ERROR_MAP, VARIANT_FORM_FIELD_MAP)) {
        toast.error(getErrorMessage(error));
      }
    }
  });

  return { form, onSubmit, isPending: mutation.isPending, isDirty: form.formState.isDirty };
};