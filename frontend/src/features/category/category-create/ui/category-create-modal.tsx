import { Button, Input, Modal } from "@/shared/ui";
import { useCreateCategoryForm } from "../model/use-create-category-form";

interface CategoryCreateModalProps {
  open: boolean;
  onClose: () => void;
}

const CreateCategoryForm = ({ onClose }: { onClose: () => void }) => {
  const { form, onSubmit, isPending } = useCreateCategoryForm({
    onSuccess: onClose,
  });

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Input
        label="Nama Category"
        placeholder="Contoh: Sepatu"
        autoComplete="off"
        autoFocus
        error={errors.name?.message}
        {...register("name")}
      />
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

export const CategoryCreateModal = ({
  open,
  onClose,
}: CategoryCreateModalProps) => (
  <Modal
    open={open}
    onOpenChange={(next) => !next && onClose()}
    title="Update Category"
    description="Slug dibuat otomatis dari nama kategori."
  >
    <CreateCategoryForm onClose={onClose} />
  </Modal>
);
