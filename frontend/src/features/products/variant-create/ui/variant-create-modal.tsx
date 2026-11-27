import { VariantFormFields } from "@/entities/product";
import { Button, Modal } from "@/shared/ui";
import { useCreateVariantForm } from "../model/use-create-variant-form";

interface VariantCreateModalProps {
  productId: string;
  open: boolean;
  onClose: () => void;
}

// Form hanya di-mount saat dialog terbuka, jadi selalu mulai bersih.
const CreateVariantForm = ({ productId, onClose }: { productId: string; onClose: () => void }) => {
  const { form, onSubmit, isPending } = useCreateVariantForm({ productId, onSuccess: onClose });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <VariantFormFields form={form} />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Batal
        </Button>
        <Button type="submit" isLoading={isPending}>
          Simpan
        </Button>
      </div>
    </form>
  );
};

export const VariantCreateModal = ({ productId, open, onClose }: VariantCreateModalProps) => (
  <Modal
    open={open}
    onOpenChange={(next) => !next && onClose()}
    title="Tambah varian"
    description="Setiap kombinasi ukuran dan warna hanya boleh ada satu."
  >
    <CreateVariantForm productId={productId} onClose={onClose} />
  </Modal>
);