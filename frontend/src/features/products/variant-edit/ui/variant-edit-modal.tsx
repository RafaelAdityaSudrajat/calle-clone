import { VariantFormFields, type Variant } from "@/entities/product";
import { Button, Modal } from "@/shared/ui";
import { useUpdateVariantForm } from "../model/use-update-variant-form";

interface VariantEditModalProps {
  productId: string;
  variant: Variant | null;
  onClose: () => void;
}

const EditVariantForm = ({
  productId,
  variant,
  onClose,
}: {
  productId: string;
  variant: Variant;
  onClose: () => void;
}) => {
  const { form, onSubmit, isPending, isDirty } = useUpdateVariantForm({
    productId,
    variant,
    onSuccess: onClose,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <VariantFormFields form={form} />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Batal
        </Button>
        <Button type="submit" isLoading={isPending} disabled={!isDirty}>
          Simpan perubahan
        </Button>
      </div>
    </form>
  );
};

export const VariantEditModal = ({ productId, variant, onClose }: VariantEditModalProps) => (
  <Modal
    open={variant !== null}
    onOpenChange={(next) => !next && onClose()}
    title="Edit varian"
    description="Ubah detail varian ini."
  >
    {variant && (
      <EditVariantForm key={variant.id} productId={productId} variant={variant} onClose={onClose} />
    )}
  </Modal>
);