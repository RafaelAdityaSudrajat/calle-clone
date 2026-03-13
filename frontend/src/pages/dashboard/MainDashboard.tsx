import { Package } from "lucide-react";

import CardDashboardSecondary from "../../components/dashboardSecondary/CardDashboardSecondary";
import MOCK_PRODUCTS from "../../datadummy/mockDataProducts";
import useSearchProduct from "./customHookDashboard/useSearchProduct";
import ProductTable from "../../components/dashboardSecondary/ProductTable";
import type { Product } from "../../types/typeProduct";
import StatisticDashboard from "./StatisticDashboard";
import SearchDashboard from "./SearchDashboard";

interface MainDashboardProps {
  handleEdit: (product: Product) => void;
  handleView: (product: Product) => void;
  handleDelete: (id: string) => void;
}

const MainDashboard = ({
  handleEdit,
  handleDelete,
  handleView,
}: MainDashboardProps) => {
  const { filteredProducts, searchQuery } = useSearchProduct(MOCK_PRODUCTS);

  // Stats
  return (
    <main className="px-6 py-8 mx-auto max-w-7xl">
      {/* Stats */}
      <StatisticDashboard />

      {/* Search */}
      <CardDashboardSecondary>
        <SearchDashboard
          searchQuery={searchQuery}
          handleSearchQuery={handleDelete}
        />

        {/* Table */}
        {filteredProducts.length > 0 ? (
          <ProductTable
            products={filteredProducts}
            onEdit={handleEdit}
            onView={handleView}
            onDelete={handleDelete}
          />
        ) : (
          <div className="p-12 text-center">
            <Package className="mx-auto mb-4 text-gray-600" size={48} />
            <h3 className="mb-2 text-lg font-semibold text-gray-400">
              No products found
            </h3>
            <p className="text-gray-500">
              Try adjusting your search or add a new product.
            </p>
          </div>
        )}
      </CardDashboardSecondary>
    </main>
  );
};

export default MainDashboard;
