import type { Category } from "@/entities/category";
import { Button, Input, Modal } from "@/shared/ui";
import { useUpdateCategoryForm } from "../model/use-update-category-form";

interface CategoryEditModalProps {
  category: Category | null;
  onClose: () => void;
}

const EditCategoryForm = ({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) => {
  const { form, onSubmit, isPending, isDirty } = useUpdateCategoryForm({
    category,
    onSuccess: onClose,
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Input
        label="Nama kategori"
        autoComplete="off"
        autoFocus
        error={errors.name?.message}
        {...register("name")}
      />
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

export const CategoryEditModal = ({
  category,
  onClose,
}: CategoryEditModalProps) => (
  <Modal
    open={category !== null}
    onOpenChange={(next) => !next && onClose()}
    title="Edit kategori"
    description="Ubah nama kategori. Slug akan ikut diperbarui."
  >
    {category && (
      <EditCategoryForm
        key={category.id}
        category={category}
        onClose={onClose}
      />
    )}
  </Modal>
);
