import { useState } from "react";
import type { ModalMode } from "@/shared/types/typeModalMode";
import type { Product } from "@/entities/product";

import ProductModalDashboard from "../../widgets/dashboardSecondary/ProductModalDashboard";
import DashboardLayout from "@/widgets/layout/DashboardLayout";
import HeaderDashboard from "./HeaderDashboard";
import MainDashboard from "./MainDashboard";

interface ModalStateProps {
  isOpen: boolean;
  mode: ModalMode;
  product: Product | null;
}

const Dashboard: React.FC = () => {
  const [modalState, setModalState] = useState<ModalStateProps>({
    isOpen: false,
    mode: null,
    product: null,
  });

  // CRUD handlers module
  const handleCreate = () => {
    setModalState({ isOpen: true, mode: "create", product: null });
  };

  const handleEdit = (product: Product) => {
    setModalState({ isOpen: true, mode: "edit", product });
  };

  const handleView = (product: Product) => {
    setModalState({ isOpen: true, mode: "view", product });
  };

  const handleSave = (productData: Partial<Product>) => {
    // TODO: Implement your save logic here
    console.log("Save product:", productData);
    setModalState({ isOpen: false, mode: null, product: null });
  };

  const handleDelete = (id: string) => {
    // TODO: Implement your delete logic here
    if (window.confirm("Are you sure you want to delete this product?")) {
      console.log("Delete product:", id);
    }
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, mode: null, product: null });
  };
  return (
    <DashboardLayout>
      <div className="min-h-screen text-white bg-black">
        {/* Header */}
        <HeaderDashboard handleCreate={handleCreate} />

        {/* Main Content */}
        <MainDashboard
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleView={handleView}
        />

        {/* Modal */}
        <ProductModalDashboard
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          product={modalState.product}
          onClose={handleCloseModal}
          onSave={handleSave}
          onDelete={
            modalState.product
              ? () => handleDelete(modalState.product!.id)
              : undefined
          }
        />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
