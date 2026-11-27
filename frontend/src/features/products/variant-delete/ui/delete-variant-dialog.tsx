import {
  willDeactivateOnVariantDelete,
  type ProductDetail,
  type Variant,
} from "@/entities/product";
import { ConfirmDialog } from "@/shared/ui";
import { useDeleteVariant } from "../model/use-delete-variant";

interface DeleteVariantDialogProps {
  product: ProductDetail;
  variant: Variant | null;
  onClose: () => void;
}

export const DeleteVariantDialog = ({ product, variant, onClose }: DeleteVariantDialogProps) => {
  const { mutate, isPending } = useDeleteVariant(product.id);

  const description = variant
    ? [
        `Varian ${variant.sku} akan dihapus. SKU-nya tetap tidak bisa dipakai ulang.`,
        willDeactivateOnVariantDelete(product, variant.id) &&
          "Ini varian aktif terakhir, jadi produk akan otomatis dinonaktifkan.",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <ConfirmDialog
      open={variant !== null}
      onOpenChange={(next) => !next && onClose()}
      title="Hapus varian?"
      description={description}
      isLoading={isPending}
      onConfirm={() => {
        if (variant) mutate(variant.id, { onSuccess: onClose });
      }}
    />
  );
};