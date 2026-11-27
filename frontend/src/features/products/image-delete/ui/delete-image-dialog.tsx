import {
  willDeactivateOnImageDelete,
  type ProductDetail,
  type ProductImage,
} from "@/entities/product";
import { ConfirmDialog } from "@/shared/ui";
import { useDeleteImage } from "../model/use-delete-image";

interface DeleteImageDialogProps {
  product: ProductDetail;
  image: ProductImage | null;
  onClose: () => void;
}

export const DeleteImageDialog = ({ product, image, onClose }: DeleteImageDialogProps) => {
  const { mutate, isPending } = useDeleteImage(product.id);

  const description = image
    ? [
        "Gambar akan dihapus permanen.",
        image.is_primary &&
          product.images.length > 1 &&
          "Gambar lain akan otomatis menjadi gambar utama.",
        willDeactivateOnImageDelete(product, image.id) &&
          "Ini gambar terakhir, jadi produk akan otomatis dinonaktifkan.",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <ConfirmDialog
      open={image !== null}
      onOpenChange={(next) => !next && onClose()}
      title="Hapus gambar?"
      description={description}
      isLoading={isPending}
      onConfirm={() => {
        if (image) mutate(image.id, { onSuccess: onClose });
      }}
    />
  );
};