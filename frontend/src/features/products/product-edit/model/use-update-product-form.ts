import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PRODUCT_FORM_ERROR_MAP,
  PRODUCT_FORM_FIELD_MAP,
  productKeys,
  toProductPayload,
  updateProduct,
  useProductForm,
  type ProductDetail,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { applyApiErrorToForm } from "@/shared/lib/form-errors";

interface Options {
  product: ProductDetail;
  onSuccess?: () => void;
}

// Pakai key={product.id} di komponen pemakainya agar form ter-reset saat produk berganti.
export const useUpdateProductForm = ({ product, onSuccess }: Options) => {
  const queryClient = useQueryClient();
  const form = useProductForm({
    name: product.name,
    description: product.description ?? "",
    categoryId: product.category?.id ?? "",
  });

  const mutation = useMutation({
    mutationFn: (values: Parameters<typeof toProductPayload>[0]) =>
      updateProduct(product.id, toProductPayload(values)),
    onSuccess: async () => {
      // Seluruh cache produk: nama/kategori tampil di list maupun detail.
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Produk berhasil diperbarui");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
      form.reset(values); // jadikan nilai tersimpan sebagai baseline baru (isDirty kembali false)
      onSuccess?.();
    } catch (error) {
        if (!applyApiErrorToForm(error, form.setError, PRODUCT_FORM_ERROR_MAP , PRODUCT_FORM_FIELD_MAP)) {
              toast.error(getErrorMessage(error));
            }
    }
  });

  return { form, onSubmit, isPending: mutation.isPending, isDirty: form.formState.isDirty };
};