import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  STOCK_FORM_ERROR_MAP,
  productKeys,
  stockFormSchema,
  updateStock,
  type StockFormValues,
  type Variant,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { applyApiErrorToForm } from "@/shared/lib/form-errors";

interface Options {
  productId: string;
  variant: Pick<Variant, "id" | "stock">;
  onSuccess?: () => void;
}

export const useUpdateStockForm = ({ productId, variant, onSuccess }: Options) => {
  const queryClient = useQueryClient();
  const form = useForm<StockFormValues>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: { stock: variant.stock },
  });

  const mutation = useMutation({
    mutationFn: ({ stock }: StockFormValues) => updateStock(productId, variant.id, stock),
    onSuccess: async () => {
      // Memengaruhi total_stock di list, detail, daftar varian, dan low-stock.
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Stok diperbarui");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
      form.reset(values);
      onSuccess?.();
    } catch (error) {
      if (!applyApiErrorToForm(error, form.setError, STOCK_FORM_ERROR_MAP)) {
        toast.error(getErrorMessage(error));
      }
    }
  });

  return { form, onSubmit, isPending: mutation.isPending, isDirty: form.formState.isDirty };
};