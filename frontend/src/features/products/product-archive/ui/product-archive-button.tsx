import { useState } from "react";
import { Button, ConfirmDialog } from "@/shared/ui";
import { useArchiveProduct } from "../model/use-archive-product";

interface ProductArchiveButtonProps {
  productId: string;
  productName: string;
  onArchived?: () => void;
}

export const ProductArchiveButton = ({
  productId,
  productName,
  onArchived,
}: ProductArchiveButtonProps) => {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useArchiveProduct();

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Arsipkan produk
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Arsipkan produk?"
        description={`"${productName}" akan diarsipkan dan tidak dapat dipulihkan dari aplikasi.`}
        confirmLabel="Arsipkan"
        isLoading={isPending}
        onConfirm={() =>
          mutate(productId, {
            onSuccess: () => {
              setOpen(false);
              onArchived?.();
            },
          })
        }
      />
    </>
  );
};