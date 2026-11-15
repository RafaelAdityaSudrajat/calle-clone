import DashboardLayout from "@/app/layout/DashboardLayout";
import { CategoryEditModal } from "@/features/category/category-update";
import { useCategoryDialogStore } from "./model/category-dialog.store";

import { CategoryCreateSection } from "@/features/category/category-create/ui/CategoryCreateSection";
import { CategoryListSection } from "@/widgets/category/CategoryListSection";

const AdminCategoriesPage = () => {
  const dialog = useCategoryDialogStore((s) => s.dialog);
  const close = useCategoryDialogStore((s) => s.close);

  return (
    <DashboardLayout>
      <h1 className="mb-6 text-xl tracking-tight font-extralight text-dashboardTextPrimary">
        Add Category
      </h1>

      <CategoryCreateSection />
      <CategoryListSection />

      <CategoryEditModal
        category={dialog.type === "edit" ? dialog.category : null}
        onClose={close}
      />
    </DashboardLayout>
  );
};

export default AdminCategoriesPage;
