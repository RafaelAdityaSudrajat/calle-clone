import { useCategories } from "@/entities/category";
import { useDeleteCategory } from "@/features/category/category-delete";
import { useCategoryDialogStore } from "@/pages/dashboard/add-category-page/model/category-dialog.store";
import { getErrorMessage } from "@/shared/api";

import { CategoryListSkeleton } from "./CategoryListSkeleton";
import { CategoryTable } from "./CategoryTable";
import { ErrorState } from "@/shared/ui";

export const CategoryListSection = () => {
  const { data, isPending, isError, error, refetch, isFetching } =
    useCategories();
  const deleteMutation = useDeleteCategory();
  const openEdit = useCategoryDialogStore((s) => s.openEdit);

  if (isPending) return <CategoryListSkeleton />;

  if (isError) {
    return (
      <ErrorState
        message={getErrorMessage(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  const handleDelete = (id: string, name: string) => {
    const ok = window.confirm(`Hapus kategori "${name}"?`);
    if (!ok) return;
    deleteMutation.mutate(id);
  };

  return (
    <CategoryTable
      data={data ?? []}
      isFetching={isFetching}
      deletingId={
        deleteMutation.isPending ? (deleteMutation.variables ?? null) : null
      }
      isDeletePending={deleteMutation.isPending}
      onEdit={openEdit}
      onDelete={handleDelete}
    />
  );
};
