import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PRODUCT_FORM_ERROR_MAP,
  PRODUCT_FORM_FIELD_MAP,
  createProduct,
  productKeys,
  toProductPayload,
  useProductForm,
  type CreateProductResponse,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { applyApiErrorToForm } from "@/shared/lib/form-errors";

interface Options {
  /** Menerima produk DRAFT yang baru dibuat, mis. untuk redirect ke halaman detail. */
  onSuccess?: (product: CreateProductResponse) => void;
}

export const useCreateProductForm = ({ onSuccess }: Options = {}) => {
  const queryClient = useQueryClient();
  const form = useProductForm();

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      toast.success("Produk dibuat sebagai draft");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const product = await mutation.mutateAsync(toProductPayload(values));
      form.reset();
      onSuccess?.(product);
    } catch (error) {
      if (!applyApiErrorToForm(error, form.setError, PRODUCT_FORM_ERROR_MAP , PRODUCT_FORM_FIELD_MAP)) {
        toast.error(getErrorMessage(error));
      }
    }
  });

  return { form, onSubmit, isPending: mutation.isPending };
};